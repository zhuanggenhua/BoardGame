import { describe, expect, it } from 'vitest';
import {
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createCorpseLootReadyCore,
    createFirstScenarioHauntCore,
    createFirstScenarioReadyToExorciseCore,
    createFirstScenarioReadyToLearnAboutJackCore,
    createFirstScenarioReadyToStudyExorcismCore,
    createJackSpiritReviveReadyCore,
    createJackSpiritPostReviveAttackReadyCore,
    createFirstScenarioReadyToTraitorVictoryCore,
    createStartedFirstScenarioCore,
    playFirstScenarioToSurvivorVictory,
    playFirstScenarioToTraitorVictory,
} from '../testing/firstScenarioTestUtils';
import { BETRAYAL_COMMANDS, BetrayalDomain, EXPLORER_CATALOG, resolveMoveTargetRooms, resolveUseEffect, type BetrayalCore } from '../game';
import { BETRAYAL_DISCOVERY_POOLS, BETRAYAL_SCENARIO_CONFIGS, type BetrayalTraitKey } from '../scenarioConfig';
import { resolvePossessionAtlasVisual } from '../possessionAtlas';
import { BETRAYAL_ROOM_TILE_VISUALS } from '../roomAtlas';

function findTestExplorer(core: BetrayalCore, playerId: string) {
    const explorer = [core.currentExplorer, ...core.otherExplorers].find((candidate) => candidate.playerId === playerId);
    if (!explorer) {
        throw new Error(`山屋测试夹具缺少玩家 ${playerId}`);
    }
    return explorer;
}

function setTestExplorerTraits(
    core: BetrayalCore,
    playerId: string,
    traits: Partial<Record<BetrayalTraitKey, number>>,
): void {
    if (core.currentExplorer.playerId === playerId) {
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, ...traits },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        return;
    }

    core.otherExplorers = core.otherExplorers.map((explorer) => (
        explorer.playerId === playerId
            ? {
                ...explorer,
                traits: { ...explorer.traits, ...traits },
                inventory: [],
            }
            : explorer
    ));
}

function physicalTraitTotal(core: BetrayalCore, playerId: string): number {
    const explorer = findTestExplorer(core, playerId);
    return explorer.traits.might + explorer.traits.speed;
}

describe('Betrayal first scenario runtime', () => {
    it('正式局内探索会消费 setup 生成的当前局发现池顺序，而不是固定索引序列', () => {
        const reverseRandom = {
            random: () => 0.42,
            d: (max: number) => Math.max(1, Math.min(max, 1)),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array].reverse(),
        };
        let core = BetrayalDomain.setup(['0', '1', '2'], reverseRandom);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'jaden-jones' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, '0', { scenarioId: 'first-scenario' });

        expect(core.drawOrder).toEqual(['omen', 'item', 'event']);
        const expectedFirstUpperRoom = [...BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper].reverse()[0]!;
        const expectedNextUpperRoom = [...BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper].reverse()[1]!;
        expect(core.roomDiscoveryOrderByFloor.upper[0]?.name).toBe(expectedFirstUpperRoom.name);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {}, 100, createBetrayalScriptedRandom(1));

        expect(core.latestDiscovery?.kind).toBe('omen');
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe(expectedNextUpperRoom.name);
        expect(core.currentExplorer.inventory.at(-1)?.name).toBe('匕首');
    });

    it('正式发现池只使用已确认正面素材和可渲染房间图集，不再回落到最小代表池', () => {
        const itemIds = BETRAYAL_DISCOVERY_POOLS.possessions.item.map((card) => card.id);
        const omenIds = BETRAYAL_DISCOVERY_POOLS.possessions.omen.map((card) => card.id);
        const roomVisualIds = Object.values(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor)
            .flat()
            .map((room) => room.visualId);

        const allDiscoveryRooms = Object.values(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor).flat();

        expect(itemIds).toHaveLength(11);
        expect(omenIds).toEqual([
            'omen-book',
            'dog',
            'mask',
            'skull',
            'holy-symbol',
            'armor',
            'idol',
            'ring',
            'dagger',
        ]);
        expect(new Set([...itemIds, ...omenIds]).size).toBe(itemIds.length + omenIds.length);
        expect(allDiscoveryRooms).toHaveLength(42);
        expect(allDiscoveryRooms.every((room) => room.doorways.length > 0)).toBe(true);

        for (const card of [
            ...BETRAYAL_DISCOVERY_POOLS.possessions.item,
            ...BETRAYAL_DISCOVERY_POOLS.possessions.omen,
            ...Object.values(BETRAYAL_SCENARIO_CONFIGS['first-scenario'].startingInventoryByExplorerId).flat(),
        ]) {
            expect(resolvePossessionAtlasVisual(card)).not.toBeNull();
        }
        for (const visualId of roomVisualIds) {
            expect(Object.prototype.hasOwnProperty.call(BETRAYAL_ROOM_TILE_VISUALS, visualId)).toBe(true);
        }
    });

    it('火炉房在探索者结束回合时造成 1 点物理伤害', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!,
        ];
        const mightBefore = core.currentExplorer.traits.might;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('火炉房');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        const damagedExplorer = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(damagedExplorer.traits.might).toBe(mightBefore - 1);
        expect(core.currentPlayer).toBe('1');
        expect(core.activityLog[0]?.text).toContain('火炉房');
    });

    it('礼拜堂在发现板块时让发现者获得 1 点神志', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'chapel')!,
        ];
        const sanityBefore = core.currentExplorer.traits.sanity;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('礼拜堂');
        expect(core.currentExplorer.traits.sanity).toBe(sanityBefore + 1);
    });

    it('盔甲会把承受的物理伤害降低 1 点', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!,
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'armor', name: '盔甲', kind: 'omen' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        const mightBefore = core.currentExplorer.traits.might;
        const speedBefore = core.currentExplorer.traits.speed;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('火炉房');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        const armoredExplorer = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(armoredExplorer.traits.might).toBe(mightBefore);
        expect(armoredExplorer.traits.speed).toBe(speedBefore);
        expect(core.currentPlayer).toBe('1');
    });

    it('盔甲不会阻挡对力量属性的直接降低', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '阴影扑面',
                text: '阴影扑向你。失去 1 点力量。',
                effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'armor', name: '盔甲', kind: 'omen' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        const mightBefore = core.currentExplorer.traits.might;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.currentExplorer.traits.might).toBe(mightBefore - 1);
    });

    it('首剧本事件牌池使用已锁定的官方事件牌，不再沿用项目占位事件', () => {
        const eventNames = BETRAYAL_DISCOVERY_POOLS.events.map((event) => event.name);
        expect(eventNames).toEqual(['标本剥制', '说“茄子”！', '外星几何', '小丑房间', '咬一口！', '吊死鬼', '电话铃声', '小机器人', '嘎吱的木门', '脑状食品', '上古旧宅', '肉质苔癣', '夜幕众星', '一抹鲜红', '一瓶微尘', '大宅饿了', '一条秘密通道', '最深的壁橱', '磁带播放器', '在你背后！', '蜘蛛！', '一种怪异的感觉', '葬礼']);
        expect(eventNames).not.toContain('回廊顺风');
        expect(eventNames).not.toContain('窃窃低语');
        expect(eventNames).not.toContain('旧日手记');
        expect(eventNames).not.toContain('滑落阶梯');
        expect(eventNames).not.toContain('墙中低语');
        expect(eventNames).not.toContain('冷风指路');
        expect(eventNames).not.toContain('阴影扑面');
        expect(eventNames).not.toContain('残留祝福');
    });

    it('标本剥制按官方锁定文本执行力量检定成功和失败分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制')!];
        core.currentExplorer.traits.might = 3;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('标本剥制');
        expect(core.latestDiscovery?.detail).toContain('力量检定 6');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点神志');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(5);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).not.toContain('obstacle');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('标本剥制');
        expect(core.latestDiscovery?.detail).toContain('力量检定 0');
        expect(core.latestDiscovery?.detail).toContain('受到 1 点物理伤害');
        expect(core.latestDiscovery?.detail).toContain('放置障碍物');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).toContain('obstacle');
    });

    it('外星几何按官方锁定文本执行知识检定成功和失败分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '外星几何')!];
        core.currentExplorer.traits.knowledge = 3;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('外星几何');
        expect(core.latestDiscovery?.detail).toContain('知识检定 7');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点知识');
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.currentExplorer.traits.speed).toBe(4);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '外星几何')!];
        core.currentExplorer.traits.knowledge = 3;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('外星几何');
        expect(core.latestDiscovery?.detail).toContain('知识检定 1');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点速度');
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(3);
    });

    it('小丑房间支持无事发生分支与精神伤害分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小丑房间')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('小丑房间');
        expect(core.latestDiscovery?.detail).toContain('神志检定 8');
        expect(core.latestDiscovery?.detail).toContain('无事发生');
        expect(core.latestDiscovery?.tone).toBe('accent');
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(4);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小丑房间')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('小丑房间');
        expect(core.latestDiscovery?.detail).toContain('神志检定 0');
        expect(core.latestDiscovery?.detail).toContain('受到 2 点精神伤害');
        expect(core.latestDiscovery?.tone).toBe('warning');
        expect(core.currentExplorer.traits.knowledge + core.currentExplorer.traits.sanity).toBe(6);
    });

    it('一种怪异的感觉按固定 2 骰执行成功和失败分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一种怪异的感觉')!];
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('一种怪异的感觉');
        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 4');
        expect(core.latestDiscovery?.detail).toContain('无事发生');
        expect(core.latestDiscovery?.tone).toBe('accent');
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.recentRoll?.kind).toBe('eventDiceRoll');
        expect(core.recentRoll?.dice).toEqual([2, 2]);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一种怪异的感觉')!];
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        expect(core.latestDiscovery?.title).toBe('一种怪异的感觉');
        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 2');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点神志');
        expect(core.latestDiscovery?.tone).toBe('warning');
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(3);
    });

    it('葬礼按官方锁定文本执行神志检定和已发现墓地放置', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '葬礼')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.might = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('葬礼');
        expect(core.latestDiscovery?.detail).toContain('神志检定 4');
        expect(core.latestDiscovery?.detail).toContain('神志 +1');
        expect(core.currentExplorer.traits.sanity).toBe(5);
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.roomId).toBe('ground-north');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '葬礼')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.might = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('神志检定 2');
        expect(core.latestDiscovery?.detail).toContain('神志 -1');
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.roomId).toBe('ground-north');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '葬礼')!];
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorer.traits.might = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.rooms = core.rooms.map((room) => (
            room.id === 'ground-east'
                ? {
                    ...room,
                    name: '墓园',
                    state: 'discovered',
                    floor: 'ground',
                    visualId: 'graveyard',
                    connectedRoomIds: [...room.connectedRoomIds],
                    doorways: room.doorways.map((doorway) => ({ ...doorway })),
                }
                : room
        ));

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('神志检定 0');
        expect(core.latestDiscovery?.detail).toContain('力量 -1');
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.roomId).toBe('ground-east');
    });

    it('电话铃声按固定 2 骰执行增益、骰数精神伤害和骰数物理伤害分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '电话铃声')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('电话铃声');
        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 4');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点神志');
        expect(core.currentExplorer.traits.sanity).toBe(5);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '电话铃声')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 2');
        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的精神伤害');
        expect(core.currentExplorer.traits.knowledge).toBe(2);
        expect(core.currentExplorer.traits.sanity).toBe(4);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '电话铃声')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 3, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 0');
        expect(core.latestDiscovery?.detail).toContain('受到两颗骰子的物理伤害');
        expect(core.currentExplorer.traits.might).toBe(1);
        expect(core.currentExplorer.traits.speed).toBe(3);
    });

    it('小机器人按官方锁定文本执行抽物品和骰数物理伤害分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小机器人')!];
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const inventoryBefore = core.currentExplorer.inventory.length;
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('小机器人');
        expect(core.latestDiscovery?.detail).toContain('知识检定 9');
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');
        expect(core.currentExplorer.inventory).toHaveLength(inventoryBefore + 1);
        expect(core.currentExplorerInventory).toHaveLength(inventoryBefore + 1);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小机器人')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 3;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 1, 1, 1, 1, 3),
        );

        expect(core.latestDiscovery?.title).toBe('小机器人');
        expect(core.latestDiscovery?.detail).toContain('知识检定 3');
        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的物理伤害');
        expect(core.currentExplorer.traits.might).toBe(2);
        expect(core.currentExplorer.traits.speed).toBe(4);
    });

    it('肉质苔癣按官方锁定文本支持选择不吸入或吸入后投骰结算', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '肉质苔癣')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('肉质苔癣');
        expect(core.latestDiscovery?.detail).toContain('可选择大口吸入芳香');
        expect(core.pendingEventChoice?.sourceTitle).toBe('肉质苔癣');
        expect(core.discardCounts.event).toBe(1);
        expect(core.turnEndedByDiscovery).toBe(false);

        const acceptWithoutTrait = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: true }),
        );
        expect(acceptWithoutTrait.valid).toBe(true);

        const mightBeforeSkip = core.currentExplorer.traits.might;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: false });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.latestDiscovery?.summary).toBe('不吸入芳香');
        expect(core.latestDiscovery?.detail).toContain('无事发生');
        expect(core.currentExplorer.traits.might).toBe(mightBeforeSkip);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '肉质苔癣')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.latestDiscovery?.summary).toBe('大口吸入芳香');
        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 4');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点任意属性');
        expect(core.latestDiscovery?.detail).not.toContain('知识 +1');
        expect(core.pendingEventChoice?.sourceTitle).toBe('肉质苔癣');
        expect(core.pendingEventChoice?.effect.mode).toBe('chosenTrait');
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.recentRoll?.kind).toBe('eventDiceRoll');
        expect(core.recentRoll?.dice).toEqual([2, 2]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'knowledge' },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
        expect(core.currentExplorer.traits.knowledge).toBe(5);
        expect(core.recentRoll?.kind).toBe('eventDiceRoll');
        expect(core.recentRoll?.dice).toEqual([2, 2]);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '肉质苔癣')!];
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(1, 1, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 0');
        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的精神伤害');
        expect(core.currentExplorer.traits.knowledge).toBe(2);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('兔脚重掷肉质苔癣成功分支时保留待选属性而不提前结算', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '肉质苔癣')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, might: 4, knowledge: 4 },
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.pendingEventChoice?.effect.mode).toBe('chosenTrait');
        expect(core.recentRoll?.latestLabel).toContain('获得 1 点任意属性');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        expect(core.recentRoll?.dice).toEqual([2, 2]);
        expect(core.pendingEventChoice?.effect.mode).toBe('chosenTrait');
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.latestDiscovery?.detail).toContain('获得 1 点任意属性');
        expect(core.latestDiscovery?.detail).not.toContain('知识 +1');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'knowledge' },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(5);
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
    });

    it('夜幕众星按官方锁定文本支持选择属性检定、所选属性增减和治疗', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '夜幕众星')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.speed = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('夜幕众星');
        expect(core.latestDiscovery?.detail).toContain('选择一项属性进行检定');
        expect(core.pendingEventChoice?.sourceTitle).toBe('夜幕众星');
        expect(core.discardCounts.event).toBe(1);
        expect(core.turnEndedByDiscovery).toBe(false);

        const missingTrait = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {}),
        );
        expect(missingTrait.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.summary).toBe('选择一项属性进行检定');
        expect(core.latestDiscovery?.detail).toContain('知识检定 9');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点所选属性');
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
        expect(core.currentExplorer.traits.knowledge).toBe(5);
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.recentRoll?.kind).toBe('eventTraitCheck');
        expect(core.recentRoll?.trait).toBe('knowledge');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '夜幕众星')!];
        core.currentExplorer.traits.speed = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'speed' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery?.detail).toContain('速度检定 4');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点所选属性');
        expect(core.latestDiscovery?.detail).toContain('速度 -1');
        expect(core.currentExplorer.traits.speed).toBe(3);
        expect(core.turnEndedByDiscovery).toBe(true);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '夜幕众星')!];
        const sanityTemplateValue = core.currentExplorer.traits.sanity;
        core.currentExplorer.traits.sanity = 2;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'sanity' },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('神志检定 0');
        expect(core.latestDiscovery?.detail).toContain('治疗所选属性');
        expect(core.latestDiscovery?.detail).toContain('治疗神志');
        expect(core.currentExplorer.traits.sanity).toBe(sanityTemplateValue);
        expect(core.turnEndedByDiscovery).toBe(false);
    });

    it('一抹鲜红按官方锁定文本支持可选作祟检定、速度奖励和跳过伤害', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一抹鲜红')!];
        core.currentExplorer.traits.speed = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('一抹鲜红');
        expect(core.latestDiscovery?.detail).toContain('可选择进行作祟检定');
        expect(core.pendingEventChoice?.sourceTitle).toBe('一抹鲜红');
        expect(core.discardCounts.event).toBe(1);
        expect(core.turnEndedByDiscovery).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.phase).toBe('preHaunt');
        expect(core.latestDiscovery?.detail).toContain('作祟检定 0');
        expect(core.latestDiscovery?.detail).toContain('速度 +1');
        expect(core.currentExplorer.traits.speed).toBe(5);
        expect(core.turnEndedByDiscovery).toBe(false);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一抹鲜红')!];
        const mightBeforeSkip = core.currentExplorer.traits.might;
        const speedBeforeSkip = core.currentExplorer.traits.speed;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: false },
            100,
            createBetrayalScriptedRandom(2),
        );

        expect(core.latestDiscovery?.summary).toBe('跳过作祟检定');
        expect(core.latestDiscovery?.detail).toContain('受到 1 颗骰子的物理伤害');
        expect(core.currentExplorer.traits.might + core.currentExplorer.traits.speed).toBe(mightBeforeSkip + speedBeforeSkip - 1);
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('一抹鲜红作祟检定成功会复用正式 haunt 触发链路', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一抹鲜红')!];
        const extraOmens = [
            { id: 'omen-book', name: '书本', kind: 'omen' as const },
            { id: 'dog', name: '狗', kind: 'omen' as const },
            { id: 'mask', name: '面具', kind: 'omen' as const },
        ];
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            ...extraOmens,
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === core.currentExplorer.playerId
                ? { ...core.currentExplorer, inventory: [...core.currentExplorer.inventory] }
                : explorer
        ));

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.traitorPlayerId).toBe('0');
        expect(core.scenarioRuntime.hauntCardNumber).toBe(1);
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe('A Splash of Crimson');
        expect(core.latestDiscovery?.detail).toContain('作祟检定 6');
        expect(core.activityLog[0]?.text).toContain('Crimson Jack Returns');
    });

    it('一瓶微尘按官方锁定文本支持可选作祟检定、神志奖励和跳过属性变化', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一瓶微尘')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('一瓶微尘');
        expect(core.latestDiscovery?.detail).toContain('可选择进行作祟检定');
        expect(core.pendingEventChoice?.sourceTitle).toBe('一瓶微尘');
        expect(core.discardCounts.event).toBe(1);
        expect(core.turnEndedByDiscovery).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.phase).toBe('preHaunt');
        expect(core.latestDiscovery?.detail).toContain('作祟检定 0');
        expect(core.latestDiscovery?.detail).toContain('神志 +1');
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(5);
        expect(core.turnEndedByDiscovery).toBe(false);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一瓶微尘')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.sanity = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: false });

        expect(core.latestDiscovery?.summary).toBe('跳过作祟检定');
        expect(core.latestDiscovery?.detail).toContain('力量 -1');
        expect(core.latestDiscovery?.detail).toContain('神志 +1');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(5);
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('一瓶微尘作祟检定成功会记录剧本3并进入作祟状态', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一瓶微尘')!];
        const extraOmens = [
            { id: 'omen-book', name: '书本', kind: 'omen' as const },
            { id: 'dog', name: '狗', kind: 'omen' as const },
            { id: 'mask', name: '面具', kind: 'omen' as const },
        ];
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            ...extraOmens,
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === core.currentExplorer.playerId
                ? { ...core.currentExplorer, inventory: [...core.currentExplorer.inventory] }
                : explorer
        ));

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.traitorPlayerId).toBe('0');
        expect(core.scenarioRuntime.hauntCardNumber).toBe(3);
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe('A Dusty Vial');
        expect(core.latestDiscovery?.detail).toContain('作祟检定 6');
        expect(core.activityLog[0]?.text).toContain('剧本3');
        expect(core.activityLog[0]?.text).toContain('A Dusty Vial');
        expect(core.activityLog[0]?.text).not.toContain('Crimson Jack Returns');
    });

    it('大宅饿了按官方锁定文本支持可选作祟检定、力量奖励和跳过任选属性', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '大宅饿了')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('大宅饿了');
        expect(core.latestDiscovery?.detail).toContain('可选择进行作祟检定');
        expect(core.pendingEventChoice?.sourceTitle).toBe('大宅饿了');
        expect(core.discardCounts.event).toBe(1);
        expect(core.turnEndedByDiscovery).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.phase).toBe('preHaunt');
        expect(core.latestDiscovery?.detail).toContain('作祟检定 0');
        expect(core.latestDiscovery?.detail).toContain('力量 +1');
        expect(core.currentExplorer.traits.might).toBe(5);
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.turnEndedByDiscovery).toBe(false);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '大宅饿了')!];
        core.currentExplorer.traits.might = 4;
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        const missingTrait = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: false }),
        );
        expect(missingTrait.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { accept: false, trait: 'knowledge' });

        expect(core.latestDiscovery?.summary).toBe('跳过作祟检定');
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(5);
        expect(core.turnEndedByDiscovery).toBe(false);
    });

    it('大宅饿了作祟检定成功会记录剧本12并进入作祟状态', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '大宅饿了')!];
        const extraOmens = [
            { id: 'omen-book', name: '书本', kind: 'omen' as const },
            { id: 'dog', name: '狗', kind: 'omen' as const },
            { id: 'mask', name: '面具', kind: 'omen' as const },
        ];
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            ...extraOmens,
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === core.currentExplorer.playerId
                ? { ...core.currentExplorer, inventory: [...core.currentExplorer.inventory] }
                : explorer
        ));

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.traitorPlayerId).toBe('0');
        expect(core.scenarioRuntime.hauntCardNumber).toBe(12);
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe('大宅饿了');
        expect(core.latestDiscovery?.detail).toContain('作祟检定 6');
        expect(core.activityLog[0]?.text).toContain('剧本12');
        expect(core.activityLog[0]?.text).toContain('大宅饿了');
        expect(core.activityLog[0]?.text).not.toContain('Crimson Jack Returns');
    });

    it('说“茄子”！按官方锁定文本支持作祟33、魔法相机奸徒和失败抽物品', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '说“茄子”！')!];
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'omen-book', name: '书本', kind: 'omen' },
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'mask', name: '面具', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer) => {
            if (explorer.playerId === '0') {
                return { ...core.currentExplorer, inventory: [...core.currentExplorer.inventory] };
            }
            if (explorer.playerId === '1') {
                return { ...explorer, inventory: [{ id: 'camera', name: '魔法相机', kind: 'item' }] };
            }
            return explorer;
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntCardNumber).toBe(33);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('0');
        expect(core.scenarioRuntime.traitorPlayerId).toBe('1');
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe('说“茄子”！');
        expect(core.latestDiscovery?.detail).toContain('作祟检定 6');
        expect(core.activityLog[0]?.text).toContain('剧本33');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '说“茄子”！')!];
        core.possessionOrderByKind.item = [{ id: 'camera', name: '魔法相机', kind: 'item' }];
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'omen-book', name: '书本', kind: 'omen' },
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'mask', name: '面具', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...core.currentExplorer, inventory: [...core.currentExplorer.inventory] }
                : explorer
        ));

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: true },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.phase).toBe('preHaunt');
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');
        expect(core.currentExplorer.inventory.at(-1)?.name).toBe('魔法相机');
        expect(core.turnEndedByDiscovery).toBe(false);
    });

    it('最深的壁橱按官方锁定文本执行抽物品、精神伤害和地下室放置分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '最深的壁橱')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, speed: 2 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('最深的壁橱');
        expect(core.latestDiscovery?.detail).toContain('速度检定 4');
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');
        expect(core.currentExplorer.inventory).toHaveLength(1);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '最深的壁橱')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, knowledge: 4, sanity: 4, speed: 2 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('速度检定 1');
        expect(core.latestDiscovery?.detail).toContain('受到 1 点精神伤害');
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(4);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '最深的壁橱')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, might: 4, speed: 2 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('速度检定 0');
        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的物理伤害');
        expect(core.latestDiscovery?.detail).toContain('放置到地下室起始点');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.activeRoomId).toBe('basement-landing');
        expect(core.currentExplorer.traits.might).toBe(2);
        expect(core.currentExplorer.traits.speed).toBe(2);
    });

    it('嘎吱的木门按官方锁定文本执行知识检定和楼层起始点放置', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '嘎吱的木门')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, knowledge: 4 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 2, 2),
        );

        expect(core.latestDiscovery?.title).toBe('嘎吱的木门');
        expect(core.latestDiscovery?.detail).toContain('知识检定 6');
        expect(core.latestDiscovery?.detail).toContain('放置到上层起始板块');
        expect(core.currentExplorer.roomId).toBe('upper-landing');
        expect(core.activeRoomId).toBe('upper-landing');
        expect(core.turnEndedByDiscovery).toBe(false);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '嘎吱的木门')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, knowledge: 4 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 4');
        expect(core.latestDiscovery?.detail).toContain('放置到地面层起始板块');
        expect(core.currentExplorer.roomId).toBe('grand-staircase');
        expect(core.activeRoomId).toBe('grand-staircase');
        expect(core.turnEndedByDiscovery).toBe(false);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '嘎吱的木门')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: { ...core.currentExplorer.traits, knowledge: 2 },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 0');
        expect(core.latestDiscovery?.detail).toContain('放置到地下室起始板块');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.activeRoomId).toBe('basement-landing');
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('脑状食品按官方锁定文本执行力量检定三档、属性选择和通用伤害分配', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '脑状食品')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('脑状食品');
        expect(core.latestDiscovery?.detail).toContain('力量检定 6');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点力量或速度');
        expect(core.pendingEventChoice?.sourceTitle).toBe('脑状食品');

        const missingTrait = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {}),
        );
        expect(missingTrait.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { trait: 'speed' });
        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.speed).toBe(5);
        expect(core.turnEndedByDiscovery).toBe(false);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '脑状食品')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('力量检定 2');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点速度并失去 1 点神志');
        expect(core.currentExplorer.traits.speed).toBe(5);
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.turnEndedByDiscovery).toBe(true);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '脑状食品')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('力量检定 0');
        expect(core.latestDiscovery?.detail).toContain('受到 2 点通用伤害');
        expect(core.pendingEventChoice?.sourceTitle).toBe('脑状食品');

        const missingDamageTraits = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { traits: ['might'] }),
        );
        expect(missingDamageTraits.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { traits: ['might', 'knowledge'] },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.latestDiscovery?.detail).toContain('通用伤害 2（力量、知识）');
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('上古旧宅按官方锁定文本选择速度或力量检定、目标板块和伤害分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '上古旧宅')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                speed: 5,
                might: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('上古旧宅');
        expect(core.pendingEventChoice?.sourceTitle).toBe('上古旧宅');
        const missingTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { trait: 'speed' }),
        );
        expect(missingTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'speed', targetRoomId: 'upper-landing' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3),
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.latestDiscovery?.detail).toContain('速度检定 10');
        expect(core.latestDiscovery?.detail).toContain('放置到任意板块');
        expect(core.latestDiscovery?.detail).toContain('放置到上层起始点');
        expect(core.currentExplorer.roomId).toBe('upper-landing');
        expect(core.turnEndedByDiscovery).toBe(false);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '上古旧宅')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                speed: 4,
                might: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        const invalidUpperTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
                trait: 'might',
                targetRoomId: 'upper-landing',
                traits: ['might'],
            }),
        );
        expect(invalidUpperTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'might', targetRoomId: 'hallway', traits: ['might'] },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery?.detail).toContain('力量检定 4');
        expect(core.latestDiscovery?.detail).toContain('放置到任意地面层板块，并受到 1 点通用伤害');
        expect(core.latestDiscovery?.detail).toContain('放置到门厅');
        expect(core.latestDiscovery?.detail).toContain('通用伤害 1（力量）');
        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.turnEndedByDiscovery).toBe(true);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '上古旧宅')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                speed: 2,
                might: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        const invalidGroundTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
                trait: 'speed',
                targetRoomId: 'hallway',
            }),
        );
        expect(invalidGroundTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'speed', targetRoomId: 'basement-landing' },
            100,
            createBetrayalScriptedRandom(2, 2),
        );

        expect(core.latestDiscovery?.detail).toContain('速度检定 2');
        expect(core.latestDiscovery?.detail).toContain('放置到任意地下室板块，并受到 1 点精神伤害');
        expect(core.latestDiscovery?.detail).toContain('放置到地下室起始点');
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('吊死鬼按官方锁定文本执行四项属性连续检定', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '吊死鬼')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 3,
                speed: 3,
                knowledge: 3,
                sanity: 3,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1, 1, 1, 3, 3, 1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.title).toBe('吊死鬼');
        expect(core.latestDiscovery?.detail).toContain('每项属性各检定一次');
        expect(core.recentAllTraitCheck?.results.map((result) => [result.trait, result.total, result.passed])).toEqual([
            ['might', 4, true],
            ['speed', 0, false],
            ['knowledge', 4, true],
            ['sanity', 0, false],
        ]);
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(2);
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(2);
        expect(core.turnEndedByDiscovery).toBe(true);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '吊死鬼')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 3,
                speed: 3,
                knowledge: 3,
                sanity: 3,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2),
        );

        expect(core.recentAllTraitCheck?.results.every((result) => result.passed)).toBe(true);
        expect(core.pendingEventChoice?.sourceTitle).toBe('吊死鬼');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(3);
        expect(core.currentExplorer.traits.knowledge).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.turnEndedByDiscovery).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'knowledge' },
            100,
            createBetrayalScriptedRandom(),
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.speed).toBe(3);
        expect(core.currentExplorer.traits.knowledge).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(3);
    });

    it('一条秘密通道按官方锁定文本放置秘密通道标志物并选择第二目标板块', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一条秘密通道')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );

        expect(core.latestDiscovery?.title).toBe('一条秘密通道');
        expect(core.pendingEventChoice?.sourceTitle).toBe('一条秘密通道');
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).not.toContain('secretPassage');

        const invalidSameRoom = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'ground-north' }),
        );
        expect(invalidSameRoom.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { targetRoomId: 'basement-landing' },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.knowledge).toBe(5);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.rooms.find((room) => room.id === 'basement-landing')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.latestDiscovery?.detail).toContain('在当前板块放置秘密通道标志物');
        expect(core.latestDiscovery?.detail).toContain('在地下室起始点放置秘密通道标志物');
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('basement-landing');

        core.movesRemaining = 1;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.movesRemaining).toBe(0);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一条秘密通道')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.pendingEventChoice?.sourceTitle).toBe('一条秘密通道');
        const invalidUpperTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', { targetRoomId: 'upper-landing' }),
        );
        expect(invalidUpperTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { targetRoomId: 'hallway' },
        );

        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.rooms.find((room) => room.id === 'hallway')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.turnEndedByDiscovery).toBe(true);

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一条秘密通道')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.pendingEventChoice?.sourceTitle).toBe('一条秘密通道');
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { targetRoomId: 'basement-landing' },
        );

        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.rooms.find((room) => room.id === 'basement-landing')?.markerTokens ?? []).toContain('secretPassage');
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('蜘蛛按官方锁定文本选择属性并放置到相邻板块', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '蜘蛛！')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                sanity: 4,
                speed: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery?.title).toBe('蜘蛛！');
        expect(core.pendingEventChoice?.sourceTitle).toBe('蜘蛛！');

        const invalidTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE, '0', {
                trait: 'speed',
                targetRoomId: 'upper-landing',
            }),
        );
        expect(invalidTarget.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { trait: 'speed', targetRoomId: 'hallway' },
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.speed).toBe(5);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.latestDiscovery?.detail).toContain('速度 +1');
        expect(core.latestDiscovery?.detail).toContain('放置到门厅');

        core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '蜘蛛！')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                sanity: 4,
                speed: 4,
            },
            inventory: [],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 1, 1),
        );

        expect(core.pendingEventChoice).toBeNull();
        expect(core.currentExplorer.traits.speed).toBe(5);
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.turnEndedByDiscovery).toBe(true);
    });

    it('盔甲和头戴耳机不会阻挡通用伤害', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '通用伤害边界',
                effect: {
                    mode: 'generalDamage',
                    amount: 2,
                    traits: ['might', 'sanity'],
                    recommendedAction: 'endTurn',
                },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                { id: 'armor', name: '盔甲', kind: 'omen' },
                { id: 'radio', name: '头戴耳机', kind: 'item' },
            ],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        const mightBefore = core.currentExplorer.traits.might;
        const sanityBefore = core.currentExplorer.traits.sanity;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.tone).toBe('warning');
        expect(core.currentExplorer.traits.might).toBe(mightBefore - 1);
        expect(core.currentExplorer.traits.sanity).toBe(sanityBefore - 1);
    });

    it('雕像发现事件符号板块时可选择不抽事件卡且不结算事件效果', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '阴影扑面',
                text: '阴影扑向你。失去 1 点力量。',
                effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'idol', name: '雕像', kind: 'omen' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['idol'];
        const mightBefore = core.currentExplorer.traits.might;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north', useIdol: true });

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.summary).toBe('已用雕像跳过');
        expect(core.latestDiscovery?.detail).toContain('没有抽取或结算事件卡');
        expect(core.currentExplorer.traits.might).toBe(mightBefore);
        expect(core.discardCounts.event).toBe(0);
        expect(core.activityLog[0]?.text).toContain('使用雕像跳过了事件：阴影扑面');
    });

    it('雕像会让事件中的力量检定结果 +1', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '沉重铁门',
                roll: {
                    trait: 'might',
                    branches: [
                        { min: 5, label: '推开铁门，获得 1 点力量', effect: { mode: 'trait', trait: 'might', amount: 1, recommendedAction: 'explore' } },
                        { min: 0, label: '被铁门撞伤，失去 1 点力量', effect: { mode: 'trait', trait: 'might', amount: -1, recommendedAction: 'endTurn' } },
                    ],
                },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
            },
            inventory: [{ id: 'idol', name: '雕像', kind: 'omen' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        const mightBefore = core.currentExplorer.traits.might;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.detail).toContain('力量检定 5');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点力量');
        expect(core.currentExplorer.traits.might).toBe(mightBefore + 1);
    });

    it('没有雕像或不是事件符号板块时，不能声明用雕像跳过事件', () => {
        let core = createStartedFirstScenarioCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });

        const withoutIdol = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north', useIdol: true }),
        );
        expect(withoutIdol.valid).toBe(false);
        if (!withoutIdol.valid) {
            expect(withoutIdol.error).toContain('不能使用雕像');
        }

        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'idol', name: '雕像', kind: 'omen' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['idol'];
        core.drawOrder = ['item'];

        const nonEventRoom = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north', useIdol: true }),
        );
        expect(nonEventRoom.valid).toBe(false);
        if (!nonEventRoom.valid) {
            expect(nonEventRoom.error).toContain('事件符号板块');
        }
    });

    it('洗衣滑槽在探索者结束回合时放置到地下室起始点', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'laundryChute')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });
        expect(core.rooms.find((room) => room.id === 'basement-east')?.name).toBe('洗衣滑槽');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        const movedExplorer = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(movedExplorer.roomId).toBe('basement-landing');
        expect(core.currentPlayer).toBe('1');
    });

    it('密道楼梯发现后会固定连通门厅', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'secretStaircase')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });
        expect(core.rooms.find((room) => room.id === 'basement-east')?.name).toBe('密道楼梯');

        core = {
            ...core,
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('hallway');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('basement-east');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        expect(core.currentExplorer.roomId).toBe('basement-east');
    });

    it('墓园和地下洞窟发现后会固定连通', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'graveyard')!,
        ];
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'undergroundCavern')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('墓园');

        core = {
            ...core,
            activeRoomId: 'basement-landing',
            currentExplorer: {
                ...core.currentExplorer,
                roomId: 'basement-landing',
            },
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });
        expect(core.rooms.find((room) => room.id === 'basement-east')?.name).toBe('地下洞窟');

        core = {
            ...core,
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('ground-north');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'ground-north' });
        expect(core.currentExplorer.roomId).toBe('ground-north');
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('basement-east');
    });

    it('长廊发现后会固定连通舞厅', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'ballroom')!,
        ];
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'gallery')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('舞厅');

        core = {
            ...core,
            activeRoomId: 'upper-landing',
            currentExplorer: {
                ...core.currentExplorer,
                roomId: 'upper-landing',
            },
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('长廊');

        core = {
            ...core,
            movesRemaining: 2,
            turnEndedByDiscovery: false,
        };
        expect(resolveMoveTargetRooms(core).map((room) => room.id)).toContain('ground-north');
    });

    it('储物间发现时获得 1 点力量', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'larder')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        const mightBefore = core.currentExplorer.traits.might;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });

        expect(core.rooms.find((room) => room.id === 'basement-east')?.name).toBe('储物间');
        expect(core.currentExplorer.traits.might).toBe(mightBefore + 1);
    });

    it('体育馆发现时获得 1 点速度', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'gymnasium')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        const speedBefore = core.currentExplorer.traits.speed;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });

        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('体育馆');
        expect(core.currentExplorer.traits.speed).toBe(speedBefore + 1);
    });

    it('杂物间发现时会在房间上放置障碍物标记', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'junkRoom')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });

        const junkRoom = core.rooms.find((room) => room.id === 'basement-east');
        expect(junkRoom?.name).toBe('杂物间');
        expect(junkRoom?.markerTokens).toContain('obstacle');
    });

    it('离开带障碍物标记的房间需要 2 点移动', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.basement = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.basement.find((room) => room.visualId === 'junkRoom')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'basement-east' });
        core.turnEndedByDiscovery = false;

        core.movesRemaining = 1;
        const blockedMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' }),
        );
        expect(blockedMove.valid).toBe(false);

        core.movesRemaining = 2;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        expect(core.currentExplorer.roomId).toBe('basement-landing');
        expect(core.movesRemaining).toBe(0);
    });

    it('图书馆发现时获得 1 点知识', () => {
        let core = createStartedFirstScenarioCore();
        const libraryTemplate = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'library')!;
        core.roomDiscoveryOrderByFloor.upper = [
            libraryTemplate,
            libraryTemplate,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        const knowledgeBefore = core.currentExplorer.traits.knowledge;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('图书馆');
        expect(core.currentExplorer.traits.knowledge).toBe(knowledgeBefore + 1);
    });

    it('书房发现时获得 1 点知识', () => {
        let core = createStartedFirstScenarioCore();
        const studyTemplate = BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'study')!;
        core.roomDiscoveryOrderByFloor.upper = [
            studyTemplate,
            studyTemplate,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        const knowledgeBefore = core.currentExplorer.traits.knowledge;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('书房');
        expect(core.currentExplorer.traits.knowledge).toBe(knowledgeBefore + 1);
    });

    it('器械库发现时展示物品牌直到武器，拿取武器并埋葬其余展示牌', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'armory')!,
        ];
        core.possessionOrderByKind.item = [
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'medical-kit')!,
            BETRAYAL_DISCOVERY_POOLS.possessions.item.find((card) => card.id === 'hunting-knife')!,
        ];
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('器械库');
        expect(core.currentExplorer.inventory.map((card) => card.name)).toContain('砍刀');
        expect(core.currentExplorer.inventory.some((card) => card.id.startsWith('hunting-knife-armory-'))).toBe(true);
        expect(core.discardCounts.item).toBe(1);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 2);
    });

    it('倒塌房间结束回合速度检定失败时坠落并承受物理伤害', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
        ];
        const mightBefore = core.currentExplorer.traits.might;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('倒塌房间');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 2),
        );

        const fallenExplorer = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(fallenExplorer.roomId).toBe('basement-landing');
        expect(fallenExplorer.traits.might).toBe(mightBefore - 1);
        expect(core.currentPlayer).toBe('1');
    });

    it('兔脚可以重掷倒塌房间结束回合速度检定，并按新结果回算坠落', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                speed: 4,
            },
            inventory: [
                ...core.currentExplorer.inventory,
                { id: 'rope', name: '兔脚', kind: 'item' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'rope'];
        const traitsBeforeFall = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('倒塌房间');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(1, 2, 2, 2, 2),
        );

        const fallenExplorer = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(fallenExplorer.roomId).toBe('basement-landing');
        expect(fallenExplorer.traits.might).toBe(traitsBeforeFall.might - 1);
        expect(core.recentRoll?.kind).toBe('roomEndTurnTraitCheck');
        expect(core.recentRoll?.playerId).toBe('0');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        const safeExplorer = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(safeExplorer.roomId).toBe('upper-north');
        expect(safeExplorer.traits).toEqual(traitsBeforeFall);
        expect(core.recentRoll?.latestLabel).toContain('没有坠落');
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 1 }),
        ).valid).toBe(false);
    });

    it('倒塌房间结束回合速度检定成功时不会坠落或受伤', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('倒塌房间');

        const explorerBefore = { ...core.currentExplorer };
        const mightBefore = core.currentExplorer.traits.might;
        const speedBefore = core.currentExplorer.traits.speed;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        const safeExplorer = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(safeExplorer.roomId).toBe(explorerBefore.roomId);
        expect(safeExplorer.traits.might).toBe(mightBefore);
        expect(safeExplorer.traits.speed).toBe(speedBefore);
        expect(core.activityLog[0]?.text).toContain('没有坠落');
        expect(core.currentPlayer).toBe('1');
    });

    it('狗和面具会让倒塌房间速度检定结果 +1', () => {
        const speedBonusOmens = [
            { id: 'dog', name: '狗', kind: 'omen' as const },
            { id: 'mask', name: '面具', kind: 'omen' as const },
        ];

        for (const omen of speedBonusOmens) {
            let core = createStartedFirstScenarioCore();
            core.roomDiscoveryOrderByFloor.upper = [
                BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
            ];
            core.currentExplorer = {
                ...core.currentExplorer,
                traits: {
                    ...core.currentExplorer.traits,
                    speed: 4,
                },
                inventory: [omen],
            };
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.currentExplorerInventory = [...core.currentExplorer.inventory];

            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });

            const mightBefore = core.currentExplorer.traits.might;
            const speedBefore = core.currentExplorer.traits.speed;

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.END_TURN,
                '0',
                {},
                100,
                createBetrayalScriptedRandom(2, 2, 2, 2),
            );

            const explorerAfter = core.otherExplorers.find((explorer) => explorer.playerId === '0');
            expect(explorerAfter?.roomId).toBe('upper-north');
            expect(explorerAfter?.traits.might).toBe(mightBefore);
            expect(explorerAfter?.traits.speed).toBe(speedBefore);
        }
    });

    it('狗每回合一次，可与 4 格内玩家交易任意数量物品或预兆', () => {
        let core = createFirstScenarioHauntCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'entrance-hall',
            inventory: [
                { id: 'dog', name: '狗', kind: 'omen' },
                { id: 'medical-kit', name: '急救包', kind: 'item' },
                { id: 'map', name: '地图', kind: 'item' },
            ],
        };
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: 'upper-landing', inventory: [] }
                : explorer
        ));
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['dog', 'medical-kit', 'map'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            useDog: true,
            targetPlayerId: '1',
            cardIds: ['medical-kit', 'map'],
        });

        const teammate = core.otherExplorers.find((explorer) => explorer.playerId === '1')!;
        expect(core.currentExplorer.inventory.map((card) => card.id)).toEqual(['dog']);
        expect(teammate.inventory.map((card) => card.id)).toEqual(['medical-kit', 'map']);
        expect(core.usedCardIdsThisTurn).toContain('dog');
        expect(core.activityLog[0]?.text).toContain('使用狗');

        const secondDogTrade = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                useDog: true,
                targetPlayerId: '1',
                cardIds: ['dog'],
            }),
        );
        expect(secondDogTrade.valid).toBe(false);
    });

    it('狗交易沿用正常交易限制：已用牌不能交易，收到的牌本回合不能立刻使用', () => {
        let core = createFirstScenarioHauntCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'entrance-hall',
            inventory: [
                { id: 'dog', name: '狗', kind: 'omen' },
                { id: 'medical-kit', name: '急救包', kind: 'item' },
            ],
        };
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: 'upper-landing', inventory: [] }
                : explorer
        ));
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['dog', 'medical-kit'];
        core.usedCardIdsThisTurn = ['medical-kit'];

        const tradeUsedCard = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                useDog: true,
                targetPlayerId: '1',
                cardIds: ['medical-kit'],
            }),
        );
        expect(tradeUsedCard.valid).toBe(false);
        if (!tradeUsedCard.valid) {
            expect(tradeUsedCard.error).toContain('本回合已经使用过的持有物不能交易');
        }

        core.usedCardIdsThisTurn = [];
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            useDog: true,
            targetPlayerId: '1',
            cardIds: ['medical-kit'],
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        const receiverUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '1', { cardId: 'medical-kit' }),
        );
        expect(receiverUse.valid).toBe(false);
        if (!receiverUse.valid) {
            expect(receiverUse.error).toContain('本回合新获得的持有物不能立刻使用');
        }
    });

    it('面具每回合一次，会把同板块其他探险者和怪物移动到已发现相邻板块，且不能发现新板块', () => {
        let core = createFirstScenarioHauntCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'entrance-hall',
            inventory: [
                { id: 'mask', name: '面具', kind: 'omen' },
            ],
        };
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: 'entrance-hall' }
                : explorer.playerId === '2'
                    ? { ...explorer, roomId: 'upper-landing' }
                    : explorer
        ));
        core.monsters = [{
            id: 'jack-spirit',
            name: '杰克之灵',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId: 'entrance-hall',
            might: 5,
            speed: 3,
            damage: 1,
        }];
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['mask'];

        const undiscoveredTarget = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
                cardId: 'mask',
                targetRoomId: 'upper-north',
            }),
        );
        expect(undiscoveredTarget.valid).toBe(false);
        if (!undiscoveredTarget.valid) {
            expect(undiscoveredTarget.error).toContain('已发现的相邻板块');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
            cardId: 'mask',
            targetRoomId: 'hallway',
        });

        expect(core.currentExplorer.roomId).toBe('entrance-hall');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '1')?.roomId).toBe('hallway');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '2')?.roomId).toBe('upper-landing');
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')?.roomId).toBe('hallway');
        expect(core.currentExplorer.inventory.map((card) => card.id)).toEqual(['mask']);
        expect(core.usedCardIdsThisTurn).toContain('mask');
        expect(core.activityLog[0]?.text).toContain('使用面具');

        const secondUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
                cardId: 'mask',
                targetRoomId: 'hallway',
            }),
        );
        expect(secondUse.valid).toBe(false);
    });

    it('面具可以把同板块不同目标分别移动到不同已发现相邻板块', () => {
        let core = createFirstScenarioHauntCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'hallway',
            inventory: [
                { id: 'mask', name: '面具', kind: 'omen' },
            ],
        };
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: 'hallway' }
                : explorer.playerId === '2'
                    ? { ...explorer, roomId: 'hallway' }
                    : explorer
        ));
        core.monsters = [{
            id: 'jack-spirit',
            name: '杰克之灵',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId: 'hallway',
            might: 5,
            speed: 3,
            damage: 1,
        }];
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['mask'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
            cardId: 'mask',
            targetRoomIdsByTokenId: {
                '1': 'entrance-hall',
                '2': 'grand-staircase',
                'jack-spirit': 'entrance-hall',
            },
        });

        expect(core.currentExplorer.roomId).toBe('hallway');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '1')?.roomId).toBe('entrance-hall');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '2')?.roomId).toBe('grand-staircase');
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')?.roomId).toBe('entrance-hall');
        expect(core.usedCardIdsThisTurn).toContain('mask');
        expect(core.activityLog[0]?.text).toContain('使用面具');
    });

    it('神秘电梯进入后可按骰点移动到对应楼层开放门口且每回合只能用一次', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'mysticElevator')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        core.turnEndedByDiscovery = false;
        core.movesRemaining = 2;
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('神秘电梯');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_ROOM_EFFECT,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        const elevator = core.rooms.find((room) => room.id === 'upper-north');
        expect(elevator?.floor).toBe('upper');
        expect(elevator?.connectedRoomIds.length).toBeGreaterThan(0);
        expect(core.currentExplorer.roomId).toBe('upper-north');
        expect(core.scenarioRuntime.usedRoomEffectIdsThisTurn).toContain('mysticElevator');
        expect(core.activityLog[0]?.text).toContain('神秘电梯');

        const secondUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_ROOM_EFFECT, '0', {}),
        );
        expect(secondUse.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.scenarioRuntime.usedRoomEffectIdsThisTurn).toEqual([]);
    });

    it('兔脚可以重掷神秘电梯刚投过的一颗骰子并重算楼层', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'mysticElevator')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' });
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                { id: 'rope', name: '兔脚', kind: 'item' },
                ...core.currentExplorer.inventory,
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];
        core.turnEndedByDiscovery = false;
        core.movesRemaining = 2;
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('神秘电梯');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_ROOM_EFFECT,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        expect(core.recentRoll?.kind).toBe('mysticElevator');
        expect(core.recentRoll?.dice).toEqual([2, 2]);
        expect(core.rooms.find((room) => room.id === 'upper-north')?.floor).toBe('upper');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            100,
            createBetrayalScriptedRandom(1),
        );

        expect(core.recentRoll?.dice).toEqual([0, 2]);
        expect(core.rooms.find((room) => room.id === 'upper-north')?.floor).toBe('ground');
        expect(core.currentExplorer.roomId).toBe('upper-north');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('能在第三次恶兆且 haunt roll 达标后进入真实 haunt', () => {
        const core = createFirstScenarioHauntCore();

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(true);
        expect(core.scenarioRuntime.hauntRevealerPlayerId).toBe('2');
        expect(core.scenarioRuntime.traitorPlayerId).toBe('2');
        expect(core.scenarioRuntime.hauntCardNumber).toBe(1);
        expect(core.scenarioRuntime.hauntTriggerLabel).toBe('A Splash of Crimson');
        expect(core.currentPlayer).toBe('0');
        expect(core.activityLog[0]?.text).toContain('Crimson Jack Returns');
    });

    it('本回合新获得的物品或预兆不能立刻使用，直到下一次回合开始才可用', () => {
        const fixedItemDrawRandom = {
            random: () => 0.42,
            d: (max: number) => Math.max(1, Math.min(max, 1)),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array].reverse(),
        };
        let core = BetrayalDomain.setup(['0', '1', '2'], fixedItemDrawRandom);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'jaden-jones' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, '0', { scenarioId: 'first-scenario' });
        core.drawOrder = ['item'];
        core.possessionOrderByKind.item = [
            { id: 'holy-water', name: '奇怪的药品', kind: 'item' },
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {}, 100, createBetrayalScriptedRandom(1));

        const newCardId = core.currentExplorer.inventory.at(-1)?.id;
        expect(newCardId).toBeTruthy();
        expect(core.latestDiscovery?.summary).toBe('已加入持有区');
        expect(core.turnStartInventoryCardIds).not.toContain(newCardId);

        const immediateUseValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: newCardId }),
        );
        expect(immediateUseValidation.valid).toBe(false);
        if (!immediateUseValidation.valid) {
            expect(immediateUseValidation.error).toContain('回合已经结束');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

        expect(core.currentPlayer).toBe('0');
        expect(core.turnStartInventoryCardIds).toContain(newCardId);
        const nextTurnUseValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: newCardId }),
        );
        expect(nextTurnUseValidation.valid).toBe(true);
    });

    it('持有物效果解析会统一处理主动使用牌的抽牌后缀和预览后缀', () => {
        expect(resolveUseEffect({ id: 'holy-water', name: '奇怪的药品', kind: 'item' })).toMatchObject({
            mode: 'healTraits',
            traits: ['might', 'speed'],
            consumeOnUse: true,
        });
        expect(resolveUseEffect({ id: 'holy-water-preview-3', name: '奇怪的药品', kind: 'item' })).toMatchObject({
            mode: 'healTraits',
            traits: ['might', 'speed'],
            consumeOnUse: true,
        });
        expect(resolveUseEffect({ id: 'holy-water-12', name: '奇怪的药品', kind: 'item' })).toMatchObject({
            mode: 'healTraits',
            traits: ['might', 'speed'],
            consumeOnUse: true,
        });
        expect(resolveUseEffect({ id: 'medical-kit', name: '急救包', kind: 'item' })).toMatchObject({
            mode: 'healTraits',
            traits: ['might', 'speed', 'knowledge', 'sanity'],
            consumeOnUse: true,
            target: 'selfOrSameRoomExplorer',
        });
        expect(resolveUseEffect({ id: 'map', name: '地图', kind: 'item' })).toMatchObject({
            mode: 'placeExplorer',
            target: 'anyDiscoveredRoom',
            consumeOnUse: true,
        });
        expect(resolveUseEffect({ id: 'notebook', name: '地图', kind: 'item' })).toMatchObject({
            mode: 'placeExplorer',
            target: 'anyDiscoveredRoom',
            consumeOnUse: true,
        });
        expect(resolveUseEffect({ id: 'manuscript', name: '地图', kind: 'item' })).toMatchObject({
            mode: 'placeExplorer',
            target: 'anyDiscoveredRoom',
            consumeOnUse: true,
        });
    });

    it('兔脚不能被主动使用成移动加成，真实重掷必须等待骰子明细窗口', () => {
        const core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];

        expect(resolveUseEffect({ id: 'rope', name: '兔脚', kind: 'item' })).toBeNull();

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'rope' }),
        );

        expect(validation.valid).toBe(false);
        if (!validation.valid) {
            expect(validation.error).toContain('该持有物没有主动使用效果');
        }
    });

    it('狗、圣符和雕像不能被通用使用入口误当成主动加成', () => {
        const activeCore = createStartedFirstScenarioCore();

        for (const card of [
            { id: 'dog', name: '狗', kind: 'omen' as const },
            { id: 'holy-symbol', name: '圣符', kind: 'omen' as const },
            { id: 'idol', name: '雕像', kind: 'omen' as const },
        ]) {
            const core = {
                ...activeCore,
                currentExplorer: { ...activeCore.currentExplorer, inventory: [card] },
                currentExplorerInventory: [card],
                turnStartInventoryCardIds: [card.id],
            };

            expect(resolveUseEffect(card)).toBeNull();

            const validation = BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: card.id }),
            );

            expect(validation.valid).toBe(false);
            if (!validation.valid) {
                expect(validation.error).toContain('该持有物没有主动使用效果');
            }
        }
    });

    it('未确认的历史占位持有物不能从通用使用入口获得效果', () => {
        for (const card of [
            { id: 'holy-medallion', name: '历史占位护符', kind: 'item' as const },
            { id: 'dark-omen', name: '历史占位预兆', kind: 'omen' as const },
            { id: 'cross', name: '历史占位十字架', kind: 'item' as const },
            { id: 'matches', name: '历史占位火柴', kind: 'item' as const },
        ]) {
            expect(resolveUseEffect(card)).toBeNull();
        }
    });

    it('兔脚会重掷刚刚事件检定的一颗骰子，并回写原事件分支结算', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '墙中低语',
                roll: {
                    trait: 'knowledge',
                    branches: [
                        { min: 5, label: '抵住低语，获得 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' } },
                        { min: 0, label: '被低语扰乱，失去 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' } },
                    ],
                },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 3,
            },
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 0');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点知识');
        expect(core.currentExplorer.traits.knowledge).toBe(2);
        expect(core.recentRoll?.dice).toEqual([0, 0, 0]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            100,
            createBetrayalScriptedRandom(3),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 2');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点知识');
        expect(core.currentExplorer.traits.knowledge).toBe(2);
        expect(core.recentRoll?.dice).toEqual([2, 0, 0]);
        expect(core.usedCardIdsThisTurn).toContain('rope');

        const secondUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 1 }),
        );
        expect(secondUse.valid).toBe(false);
    });

    it('兔脚重掷后若跨过事件检定阈值，会撤销旧分支并应用新分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '墙中低语',
                roll: {
                    trait: 'knowledge',
                    branches: [
                        { min: 5, label: '抵住低语，获得 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' } },
                        { min: 0, label: '被低语扰乱，失去 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' } },
                    ],
                },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 3,
            },
            inventory: [
                { id: 'rope', name: '兔脚', kind: 'item' },
                { id: 'flashlight', name: '手电筒', kind: 'item' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope', 'flashlight'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 0');
        expect(core.currentExplorer.traits.knowledge).toBe(2);
        expect(core.recentRoll?.dice).toEqual([0, 0, 0, 0, 0]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            100,
            createBetrayalScriptedRandom(3),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 2');
        expect(core.currentExplorer.traits.knowledge).toBe(2);

        core.recentRoll = {
            ...core.recentRoll!,
            consumedRabbitFootCardIds: [],
            dice: [2, 2, 2, 0, 0],
            latestLabel: '被低语扰乱，失去 1 点知识',
        };
        core.currentExplorer.traits.knowledge = 2;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.usedCardIdsThisTurn = [];
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 3 },
            100,
            createBetrayalScriptedRandom(3),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 8');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点知识');
        expect(core.currentExplorer.traits.knowledge).toBe(4);
    });

    it('兔脚可以重掷刚刚事件固定投骰，并回写原事件分支结算', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '一种怪异的感觉')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                speed: 4,
                sanity: 4,
            },
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 0');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点力量');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.recentRoll?.kind).toBe('eventDiceRoll');
        expect(core.recentRoll?.dice).toEqual([0, 0]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            100,
            createBetrayalScriptedRandom(6),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 2');
        expect(core.latestDiscovery?.detail).toContain('失去 1 点神志');
        expect(core.latestDiscovery?.tone).toBe('warning');
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(3);
        expect(core.recentRoll?.dice).toEqual([2, 0]);
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('兔脚可以重掷标本剥制力量检定，并撤销失败分支的伤害和障碍物', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '标本剥制')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                sanity: 4,
            },
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.latestDiscovery?.detail).toContain('力量检定 0');
        expect(core.currentExplorer.traits.might).toBe(3);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).toContain('obstacle');

        core.recentRoll = {
            ...core.recentRoll!,
            consumedRabbitFootCardIds: [],
            dice: [2, 2, 2, 0],
            latestLabel: '受到 1 点物理伤害；放置障碍物',
        };
        core.usedCardIdsThisTurn = [];
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 3 },
            100,
            createBetrayalScriptedRandom(3),
        );

        expect(core.latestDiscovery?.detail).toContain('力量检定 8');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点神志');
        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.sanity).toBe(5);
        expect(core.rooms.find((room) => room.id === 'ground-north')?.markerTokens ?? []).not.toContain('obstacle');
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('兔脚重掷电话铃声时会撤销旧骰数伤害并应用新分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '电话铃声')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的精神伤害');
        expect(core.currentExplorer.traits.knowledge).toBe(2);
        expect(core.currentExplorer.traits.sanity).toBe(4);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            100,
            createBetrayalScriptedRandom(6),
        );

        expect(core.latestDiscovery?.detail).toContain('投 2 颗骰子 3');
        expect(core.latestDiscovery?.detail).toContain('获得 1 点知识');
        expect(core.currentExplorer.traits.knowledge).toBe(5);
        expect(core.currentExplorer.traits.sanity).toBe(4);
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('兔脚重掷小机器人时会撤销旧抽牌并应用新分支', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '小机器人')!];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 4,
                speed: 4,
                knowledge: 4,
            },
            inventory: [{ id: 'rope', name: '兔脚', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['rope'];
        const itemDeckBefore = core.deckCounts.item;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(3, 2, 2, 2),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 5');
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');
        expect(core.currentExplorer.inventory).toHaveLength(2);
        expect(core.deckCounts.item).toBe(itemDeckBefore - 1);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            100,
            createBetrayalScriptedRandom(1, 3),
        );

        expect(core.latestDiscovery?.detail).toContain('知识检定 3');
        expect(core.latestDiscovery?.detail).toContain('受到一颗骰子的物理伤害');
        expect(core.currentExplorer.inventory).toEqual([{ id: 'rope', name: '兔脚', kind: 'item' }]);
        expect(core.currentExplorerInventory).toEqual([{ id: 'rope', name: '兔脚', kind: 'item' }]);
        expect(core.deckCounts.item).toBe(itemDeckBefore);
        expect(core.currentExplorer.traits.might).toBe(2);
        expect(core.currentExplorer.traits.speed).toBe(4);
        expect(core.usedCardIdsThisTurn).toContain('rope');
    });

    it('手电筒只在事件属性检定多投 2 颗骰，不能被主动使用成通用加成', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '墙中低语',
                roll: {
                    trait: 'knowledge',
                    branches: [
                        { min: 5, label: '抵住低语，获得 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: 1, recommendedAction: 'explore' } },
                        { min: 0, label: '被低语扰乱，失去 1 点知识', effect: { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' } },
                    ],
                },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 3,
            },
            inventory: [{ id: 'flashlight', name: '手电筒', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['flashlight'];

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'flashlight' }),
        );
        expect(validation.valid).toBe(false);
        if (!validation.valid) {
            expect(validation.error).toContain('没有主动使用效果');
        }

        const knowledgeBefore = core.currentExplorer.traits.knowledge;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' }, 100, createBetrayalScriptedRandom(3, 3, 3, 1, 1));

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.detail).toContain('知识检定 6');
        expect(core.currentExplorer.traits.knowledge).toBe(knowledgeBefore + 1);
    });

    it('盔甲是被动物理减伤防具，不能被主动使用成通用移动效果', () => {
        const core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'armor', name: '盔甲', kind: 'omen' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['armor'];

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'armor' }),
        );

        expect(validation.valid).toBe(false);
        if (!validation.valid) {
            expect(validation.error).toContain('没有主动使用效果');
        }
    });

    it('头戴耳机会把承受的精神伤害降低 1 点', () => {
        let core = createFirstScenarioHauntCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
                sanity: 4,
            },
            inventory: [{ id: 'radio', name: '头戴耳机', kind: 'item' }],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.activeRoomId = core.currentExplorer.roomId;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-north' });
        const sanityBeforeStudy = core.currentExplorer.traits.sanity;
        const knowledgeBeforeStudy = core.currentExplorer.traits.knowledge;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.STUDY_EXORCISM,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.scenarioRuntime.exorcismCircleRoomIds).toEqual([]);
        expect(core.currentExplorer.traits.sanity + core.currentExplorer.traits.knowledge).toBe(
            sanityBeforeStudy + knowledgeBeforeStudy - 1,
        );
    });

    it('头戴耳机不会阻挡对知识属性的直接降低，也不能被主动使用成通用移动效果', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '墙中低语',
                text: '墙里的声音扰乱了你的判断。失去 1 点知识。',
                effect: { mode: 'trait', trait: 'knowledge', amount: -1, recommendedAction: 'endTurn' },
            },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'radio', name: '头戴耳机', kind: 'item' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['radio'];
        const knowledgeBefore = core.currentExplorer.traits.knowledge;

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'radio' }),
        );
        expect(validation.valid).toBe(false);
        if (!validation.valid) {
            expect(validation.error).toContain('没有主动使用效果');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.currentExplorer.traits.knowledge).toBe(knowledgeBefore - 1);
    });

    it('魔法相机会让知识检定改用更高的神志属性，且不能被主动使用成通用属性加成', () => {
        let learnCore = createFirstScenarioReadyToLearnAboutJackCore();
        learnCore.currentExplorer = {
            ...learnCore.currentExplorer,
            traits: {
                ...learnCore.currentExplorer.traits,
                knowledge: 1,
                sanity: 4,
            },
            inventory: [{ id: 'camera', name: '魔法相机', kind: 'item' }],
        };
        learnCore.currentExplorerTraits = { ...learnCore.currentExplorer.traits };
        learnCore.currentExplorerInventory = [...learnCore.currentExplorer.inventory];
        learnCore.turnStartInventoryCardIds = ['camera'];

        const validation = BetrayalDomain.validate(
            { core: learnCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'camera' }),
        );
        expect(validation.valid).toBe(false);
        if (!validation.valid) {
            expect(validation.error).toContain('没有主动使用效果');
        }

        learnCore = applyBetrayalCommand(
            learnCore,
            BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 3, 2, 1),
        );
        expect(learnCore.scenarioRuntime.knowledgeOfJackPlayerIds).toContain('0');

        learnCore.currentExplorer = {
            ...learnCore.currentExplorer,
            roomId: 'upper-west',
        };
        learnCore.activeRoomId = 'upper-west';
        learnCore.currentExplorerRoomId = 'upper-west';
        learnCore.usedCardIdsThisTurn = [];
        learnCore = applyBetrayalCommand(
            learnCore,
            BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
            '0',
            {},
            101,
            createBetrayalScriptedRandom(3, 3, 2, 1),
        );
        expect(learnCore.scenarioRuntime.knowledgeOfJackPlayerIds).toContain('1');

        let studyCore = createFirstScenarioReadyToStudyExorcismCore();
        studyCore.currentExplorer = {
            ...studyCore.currentExplorer,
            traits: {
                ...studyCore.currentExplorer.traits,
                knowledge: 1,
                sanity: 4,
            },
            inventory: [{ id: 'camera', name: '魔法相机', kind: 'item' }],
        };
        studyCore.currentExplorerTraits = { ...studyCore.currentExplorer.traits };
        studyCore.currentExplorerInventory = [...studyCore.currentExplorer.inventory];
        const circleCountBefore = studyCore.scenarioRuntime.exorcismCircleRoomIds.length;

        studyCore = applyBetrayalCommand(
            studyCore,
            BETRAYAL_COMMANDS.STUDY_EXORCISM,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 3, 2, 1),
        );
        expect(studyCore.scenarioRuntime.exorcismCircleRoomIds).toHaveLength(circleCountBefore + 1);
    });

    it('奇怪的药品会埋葬并治疗当前探索者的力量和速度', () => {
        let core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 2,
                speed: 1,
            },
            inventory: [
                { id: 'holy-water', name: '奇怪的药品', kind: 'item' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['holy-water'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'holy-water' });

        expect(core.currentExplorer.traits.might).toBe(4);
        expect(core.currentExplorer.traits.speed).toBe(3);
        expect(core.currentExplorer.inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(core.usedCardIdsThisTurn).toContain('holy-water');
        expect(core.activityLog[0]?.text).toContain('埋葬奇怪的药品');

        const secondUseValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'holy-water' }),
        );
        expect(secondUseValidation.valid).toBe(false);
        if (!secondUseValidation.valid) {
            expect(secondUseValidation.error).toContain('当前没有可使用持有物');
        }
    });

    it('急救包会埋葬并治疗当前探索者的所有濒死属性', () => {
        let core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 1,
                speed: 1,
                knowledge: 1,
                sanity: 1,
            },
            inventory: [
                { id: 'medical-kit', name: '急救包', kind: 'item' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['medical-kit'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'medical-kit', targetPlayerId: '0' });

        expect(core.currentExplorer.traits).toEqual(
            EXPLORER_CATALOG.find((explorer) => explorer.explorerId === core.currentExplorer.explorerId)!.traits,
        );
        expect(core.currentExplorer.inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(core.usedCardIdsThisTurn).toContain('medical-kit');
        expect(core.activityLog[0]?.text).toContain('埋葬急救包');
    });

    it('急救包可以治疗同板块另一位探索者并从当前探索者持有区移除', () => {
        let core = createStartedFirstScenarioCore();
        const targetPlayerId = core.otherExplorers[0]!.playerId;
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                { id: 'medical-kit', name: '急救包', kind: 'item' },
            ],
        };
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === targetPlayerId
                ? {
                    ...explorer,
                    roomId: core.currentExplorer.roomId,
                    traits: {
                        ...explorer.traits,
                        might: 1,
                        speed: 1,
                        knowledge: 1,
                        sanity: 1,
                    },
                }
                : explorer
        ));
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['medical-kit'];
        const currentTraitsBefore = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
            cardId: 'medical-kit',
            targetPlayerId,
        });

        const target = core.otherExplorers.find((explorer) => explorer.playerId === targetPlayerId)!;
        expect(target.traits).toEqual(
            EXPLORER_CATALOG.find((explorer) => explorer.explorerId === target.explorerId)!.traits,
        );
        expect(core.currentExplorer.traits).toEqual(currentTraitsBefore);
        expect(core.currentExplorer.inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(core.usedCardIdsThisTurn).toContain('medical-kit');
        expect(core.activityLog[0]?.text).toContain(target.displayName);
    });

    it('急救包不能治疗不同板块的另一位探索者', () => {
        const core = createStartedFirstScenarioCore();
        const targetPlayerId = core.otherExplorers[0]!.playerId;
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [
                { id: 'medical-kit', name: '急救包', kind: 'item' },
            ],
        };
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === targetPlayerId
                ? { ...explorer, roomId: 'upper-landing' }
                : explorer
        ));
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['medical-kit'];

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
                cardId: 'medical-kit',
                targetPlayerId,
            }),
        );

        expect(validation.valid).toBe(false);
        if (!validation.valid) {
            expect(validation.error).toContain('急救包只能治疗自己或同板块的另一位探索者');
        }
    });

    it('地图会埋葬并把当前探索者放置到任一已发现板块', () => {
        let core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'entrance-hall',
            inventory: [
                { id: 'map', name: '地图', kind: 'item' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['map'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
            cardId: 'map',
            targetRoomId: 'upper-landing',
        });

        expect(core.currentExplorer.roomId).toBe('upper-landing');
        expect(core.activeRoomId).toBe('upper-landing');
        expect(core.currentExplorer.inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(core.usedCardIdsThisTurn).toContain('map');
        expect(core.activityLog[0]?.text).toContain('埋葬地图');
    });

    it('地图不能把当前探索者放置到未发现板块', () => {
        const core = createStartedFirstScenarioCore();
        core.currentExplorer.inventory = [
            { id: 'map', name: '地图', kind: 'item' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['map'];

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', {
                cardId: 'map',
                targetRoomId: 'upper-north',
            }),
        );

        expect(validation.valid).toBe(false);
        if (!validation.valid) {
            expect(validation.error).toContain('地图只能把探索者放置到已发现板块');
        }
    });

    it('骨制钥匙可以穿过墙壁移动到已发现相邻板块，且不会作为主动移动加成使用', () => {
        let core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'upper-landing',
            inventory: [{ id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['lockpick-tool'];
        core.activeRoomId = 'upper-landing';
        core.movesRemaining = 2;
        core.rooms = core.rooms.map((room) => {
            if (room.id === 'upper-landing') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-west'),
                };
            }
            if (room.id === 'upper-west') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-landing'),
                };
            }
            return room;
        });

        const normalMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-west' }),
        );
        expect(normalMove.valid).toBe(false);
        expect(resolveUseEffect({ id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' })).toBeNull();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            '0',
            { roomId: 'upper-west', useSkeletonKey: true },
            100,
            createBetrayalScriptedRandom(2),
        );

        expect(core.currentExplorer.roomId).toBe('upper-west');
        expect(core.movesRemaining).toBe(1);
        expect(core.currentExplorer.inventory).toEqual([{ id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' }]);
        expect(core.activityLog[0]?.text).toContain('使用骨制钥匙穿过墙壁');
    });

    it('骨制钥匙穿墙投到空白会被埋葬，且不能用于发现新房间', () => {
        let core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'upper-landing',
            inventory: [{ id: 'lockpick-tool', name: '骨制钥匙', kind: 'item' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['lockpick-tool'];
        core.activeRoomId = 'upper-landing';
        core.movesRemaining = 2;
        core.rooms = core.rooms.map((room) => {
            if (room.id === 'upper-landing') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-west'),
                };
            }
            if (room.id === 'upper-west') {
                return {
                    ...room,
                    doorways: room.doorways.filter((doorway) => doorway.connectsToRoomId !== 'upper-landing'),
                };
            }
            return room;
        });

        const undiscoveredMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', {
                roomId: 'upper-north',
                useSkeletonKey: true,
            }),
        );
        expect(undiscoveredMove.valid).toBe(false);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_TO_ROOM,
            '0',
            { roomId: 'upper-west', useSkeletonKey: true },
            100,
            createBetrayalScriptedRandom(1),
        );

        expect(core.currentExplorer.roomId).toBe('upper-west');
        expect(core.movesRemaining).toBe(1);
        expect(core.currentExplorer.inventory).toEqual([]);
        expect(core.currentExplorerInventory).toEqual([]);
        expect(core.activityLog[0]?.text).toContain('骨制钥匙被埋葬');
    });

    it('书本会让知识检定结果 +1，并影响调查杰克和研究法阵', () => {
        let learnCore = createFirstScenarioReadyToLearnAboutJackCore();
        learnCore.currentExplorer = {
            ...learnCore.currentExplorer,
            traits: {
                ...learnCore.currentExplorer.traits,
                knowledge: 4,
            },
            inventory: [
                { id: 'omen-book', name: '书本', kind: 'omen' },
            ],
        };
        learnCore.currentExplorerTraits = { ...learnCore.currentExplorer.traits };
        learnCore.currentExplorerInventory = [...learnCore.currentExplorer.inventory];

        learnCore = applyBetrayalCommand(
            learnCore,
            BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(learnCore.scenarioRuntime.knowledgeOfJackPlayerIds).toContain('0');
        expect(learnCore.activityLog[0]?.text).toContain('查到了 Crimson Jack 的线索');

        let studyCore = createFirstScenarioReadyToStudyExorcismCore();
        studyCore.currentExplorer = {
            ...studyCore.currentExplorer,
            traits: {
                ...studyCore.currentExplorer.traits,
                knowledge: 4,
            },
            inventory: [
                { id: 'omen-book', name: '书本', kind: 'omen' },
            ],
        };
        studyCore.currentExplorerTraits = { ...studyCore.currentExplorer.traits };
        studyCore.currentExplorerInventory = [...studyCore.currentExplorer.inventory];
        const circleCountBefore = studyCore.scenarioRuntime.exorcismCircleRoomIds.length;

        studyCore = applyBetrayalCommand(
            studyCore,
            BETRAYAL_COMMANDS.STUDY_EXORCISM,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(studyCore.scenarioRuntime.exorcismCircleRoomIds.length).toBe(circleCountBefore + 1);
        expect(studyCore.activityLog[0]?.text).toContain('布置了一处驱魔法阵');
    });

    it('书本每回合一次：失去 1 点神志，并让下一次非战斗检定可用知识替换', () => {
        let core = createFirstScenarioHauntCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 5,
                sanity: 2,
            },
            inventory: [
                { id: 'omen-book', name: '书本', kind: 'omen' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['omen-book'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'omen-book' });
        expect(core.currentExplorer.traits.sanity).toBe(1);
        expect(core.usedCardIdsThisTurn).toContain('omen-book');
        expect(core.nextNonCombatTraitReplacement).toMatchObject({
            playerId: '0',
            sourceCardId: 'omen-book',
            replacementTrait: 'knowledge',
        });

        const secondUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'omen-book' }),
        );
        expect(secondUse.valid).toBe(false);

        core.scenarioRuntime.exorcismCircleRoomIds = ['upper-north', 'upper-west'];
        core.scenarioRuntime.jackSpiritReleased = true;
        core.scenarioRuntime.jackSpiritRoomId = core.currentExplorer.roomId;
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXORCISE_JACK,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3),
        );

        expect(core.phase).toBe('endgame');
        expect(core.nextNonCombatTraitReplacement).toBeNull();
    });

    it('书本替换只作用于非战斗检定，不会让战斗对攻改用知识', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                might: 1,
                knowledge: 6,
                sanity: 2,
            },
            inventory: [
                ...core.currentExplorer.inventory,
                { id: 'omen-book', name: '书本', kind: 'omen' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'omen-book'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'omen-book' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);
        expect(core.nextNonCombatTraitReplacement).toMatchObject({
            playerId: '0',
            sourceCardId: 'omen-book',
        });
    });

    it('头骨会让知识检定结果 +1，并影响调查杰克', () => {
        let core = createFirstScenarioReadyToLearnAboutJackCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            traits: {
                ...core.currentExplorer.traits,
                knowledge: 4,
            },
            inventory: [
                { id: 'skull', name: '头骨', kind: 'omen' },
            ],
        };
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.LEARN_ABOUT_JACK,
            '0',
            {},
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.scenarioRuntime.knowledgeOfJackPlayerIds).toContain('0');
        expect(core.activityLog[0]?.text).toContain('查到了 Crimson Jack 的线索');
    });

    it('头骨在探索者将要死亡前投 3 骰，4-6 时不死亡并把所有属性调至濒死', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'ground-north' });
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, inventory: [{ id: 'skull', name: '头骨', kind: 'omen' }] }
                : explorer
        ));

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 1, 1, 1, 1, 3, 3, 1),
        );

        const protectedHero = [core.currentExplorer, ...core.otherExplorers]
            .find((explorer) => explorer.playerId === '0')!;
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('0');
        expect(protectedHero.traits).toEqual({
            might: 1,
            speed: 1,
            knowledge: 1,
            sanity: 1,
        });
        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.activityLog[0]?.text).toContain('头骨投出 4，阻止死亡');
    });

    it('头骨死亡前投 3 骰为 0-3 时仍正常死亡', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'ground-north' });
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, inventory: [{ id: 'skull', name: '头骨', kind: 'omen' }] }
                : explorer
        ));

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1),
        );

        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
    });

    it('兔脚可以重掷头骨死亡保护的一颗骰子，并按新结果阻止死亡', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'ground-north' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'ground-north' });
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? {
                    ...explorer,
                    inventory: [
                        { id: 'skull', name: '头骨', kind: 'omen' },
                        { id: 'rope', name: '兔脚', kind: 'item' },
                    ],
                }
                : explorer
        ));

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 2, 2),
        );

        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
        expect(core.recentRoll?.kind).toBe('deathPrevention');
        expect(core.recentRoll?.playerId).toBe('0');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        const protectedHero = [core.currentExplorer, ...core.otherExplorers]
            .find((explorer) => explorer.playerId === '0')!;
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('0');
        expect(protectedHero.traits).toEqual({
            might: 1,
            speed: 1,
            knowledge: 1,
            sanity: 1,
        });
        expect(core.recentRoll?.latestLabel).toContain('阻止死亡');
        expect(core.usedCardIdsThisTurn).toContain('rope');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 1 }),
        ).valid).toBe(false);
    });

    it('头骨不能被主动使用成通用知识加成', () => {
        const core = createStartedFirstScenarioCore();
        core.currentExplorer.inventory = [
            { id: 'skull', name: '头骨', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['skull'];

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'skull' }),
        );

        expect(validation.valid).toBe(false);
    });

    it('首剧本起跑位就是真实运行时，不再保留手工结算口', () => {
        const core = createStartedFirstScenarioCore();

        expect(core.phase).toBe('preHaunt');
        expect(core.endgameResult).toBeNull();
        expect(core.scenarioRuntime.hauntTriggered).toBe(false);
        expect(core.rooms.some((room) => room.id === 'upper-west' && room.name === '图书馆')).toBe(true);
    });

    it('叛徒开局按人数获得 {1/1/2/2} 点力量和速度加成', () => {
        const cases = [
            { playerIds: ['0', '1', '2'], expectedBonus: 1 },
            { playerIds: ['0', '1', '2', '3'], expectedBonus: 1 },
            { playerIds: ['0', '1', '2', '3', '4'], expectedBonus: 2 },
            { playerIds: ['0', '1', '2', '3', '4', '5'], expectedBonus: 2 },
        ];

        for (const { playerIds, expectedBonus } of cases) {
            const hauntCore = createFirstScenarioHauntCore(playerIds);
            const traitorPlayerId = hauntCore.scenarioRuntime.traitorPlayerId!;
            const traitorAfterHaunt = hauntCore.currentExplorer.playerId === traitorPlayerId
                ? hauntCore.currentExplorer
                : hauntCore.otherExplorers.find((explorer) => explorer.playerId === traitorPlayerId)!;
            const template = EXPLORER_CATALOG.find((explorer) => explorer.explorerId === traitorAfterHaunt.explorerId)!;

            expect(traitorAfterHaunt.traits.might).toBe(template.traits.might + expectedBonus);
            expect(traitorAfterHaunt.traits.speed).toBe(template.traits.speed + expectedBonus);
        }
    });

    it('英雄线可击倒叛徒、释放杰克之灵并完成驱魔结算', () => {
        const core = playFirstScenarioToSurvivorVictory();

        expect(core.phase).toBe('endgame');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-landing');
        expect(core.scenarioRuntime.exorcismCircleRoomIds).toHaveLength(2);
        expect(core.endgameResult?.hauntTitle).toBe('Crimson Jack Returns');
        expect(core.endgameResult?.outcome).toBe('survivors');
        expect(core.endgameResult?.winners).toEqual(['0', '1']);
    });

    it('叛徒线可以通过击倒全部英雄进入终局', () => {
        const core = playFirstScenarioToTraitorVictory();

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.outcome).toBe('traitor');
        expect(core.endgameResult?.traitorPlayerId).toBe('2');
        expect(core.endgameResult?.winners).toEqual(['2']);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining(['0', '1']));
    });

    it('叛徒收尾前一手前置态应停在真实 haunt 运行时，而不是直接进入终局', () => {
        const core = createFirstScenarioReadyToTraitorVictoryCore();
        const livingHeroesInRoom = core.otherExplorers.filter((explorer) => (
            explorer.playerId !== '2'
            && !core.scenarioRuntime.deadExplorerPlayerIds.includes(explorer.playerId)
            && explorer.roomId === core.activeRoomId
        ));

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.playerId).toBe('2');
        expect(core.activeRoomId).toBe('ground-north');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('0');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('1');
        expect(livingHeroesInRoom.map((explorer) => explorer.playerId)).toEqual(['1']);
    });

    it('恶兆不会在掷骰不足 5 时提前触发 haunt', () => {
        let core = createStartedFirstScenarioCore();
        const lowHauntRoll = createBetrayalScriptedRandom(1, 1, 1, 1, 1);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {}, 100, lowHauntRoll);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '1', {}, 100, lowHauntRoll);

        expect(core.phase).toBe('preHaunt');
        expect(core.scenarioRuntime.hauntTriggered).toBe(false);
        expect(core.scenarioRuntime.omensDiscovered).toBe(0);
        expect(core.latestDiscovery?.kind).toBe('item');
    });

    it('图书馆、驱魔法阵和驱魔失败都按真实投骰与伤害结算', () => {
        let core = createFirstScenarioHauntCore();
        const hauntActionRandom = createBetrayalScriptedRandom(
            1, 1, 1, 1, // 图书馆失败
            1, 1, 1, 1, // 驱魔法阵失败
            1, 1, 1, 1, 1, 1, // 驱魔失败
        );

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-west' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LEARN_ABOUT_JACK, '0', {}, 100, hauntActionRandom);
        expect(core.scenarioRuntime.knowledgeOfJackPlayerIds).toEqual([]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-north' });
        const sanityBeforeStudy = core.currentExplorer.traits.sanity;
        const knowledgeBeforeStudy = core.currentExplorer.traits.knowledge;
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.STUDY_EXORCISM, '0', {}, 100, hauntActionRandom);
        expect(core.scenarioRuntime.exorcismCircleRoomIds).toEqual([]);
        expect(core.currentExplorer.traits.sanity + core.currentExplorer.traits.knowledge).toBe(
            sanityBeforeStudy + knowledgeBeforeStudy - 2,
        );

        core.scenarioRuntime.exorcismCircleRoomIds = ['upper-north', 'upper-west'];
        core.scenarioRuntime.jackSpiritReleased = true;
        core.scenarioRuntime.jackSpiritRoomId = 'upper-north';
        const teammateBefore = core.otherExplorers.find((explorer) => explorer.playerId === '1');
        const actorBefore = { ...core.currentExplorer.traits };
        core.scenarioRuntime.exorcismCircleRoomIds = [];
        const exorciseWithoutCirclesValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXORCISE_JACK, '0', {}),
        );
        expect(exorciseWithoutCirclesValidation.valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXORCISE_JACK, '0', {}, 100, hauntActionRandom);
        const teammateAfter = core.otherExplorers.find((explorer) => explorer.playerId === '1');

        expect(core.phase).toBe('haunt');
        expect(core.currentExplorer.traits.might + core.currentExplorer.traits.speed).toBeLessThan(
            actorBefore.might + actorBefore.speed,
        );
        expect((teammateAfter?.traits.might ?? 0) + (teammateAfter?.traits.speed ?? 0)).toBeLessThan(
            (teammateBefore?.traits.might ?? 0) + (teammateBefore?.traits.speed ?? 0),
        );
    });

    it('最终驱魔失败只让每名存活英雄各承受 1 点身体伤害且不会误终局', () => {
        let core = createFirstScenarioReadyToExorciseCore();
        const actorId = core.currentExplorer.playerId;
        const teammateId = core.otherExplorers.find((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)!.playerId;
        const traitorId = core.scenarioRuntime.traitorPlayerId!;

        setTestExplorerTraits(core, actorId, { might: 4, speed: 4, knowledge: 4, sanity: 4 });
        setTestExplorerTraits(core, teammateId, { might: 4, speed: 4, knowledge: 4, sanity: 4 });
        const actorPhysicalBefore = physicalTraitTotal(core, actorId);
        const teammatePhysicalBefore = physicalTraitTotal(core, teammateId);
        const traitorPhysicalBefore = physicalTraitTotal(core, traitorId);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXORCISE_JACK,
            actorId,
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.recentRoll?.latestLabel).toBe('驱魔失败');
        expect(physicalTraitTotal(core, actorId)).toBe(actorPhysicalBefore - 1);
        expect(physicalTraitTotal(core, teammateId)).toBe(teammatePhysicalBefore - 1);
        expect(physicalTraitTotal(core, traitorId)).toBe(traitorPhysicalBefore);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain(actorId);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain(teammateId);
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-landing');
    });

    it('最终驱魔失败只会让被 1 点身体伤害打到死亡边界的英雄死亡', () => {
        let core = createFirstScenarioReadyToExorciseCore();
        const actorId = core.currentExplorer.playerId;
        const teammateId = core.otherExplorers.find((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)!.playerId;

        setTestExplorerTraits(core, actorId, { might: 4, speed: 4, knowledge: 4, sanity: 4 });
        setTestExplorerTraits(core, teammateId, { might: 2, speed: 4, knowledge: 4, sanity: 4 });
        const actorPhysicalBefore = physicalTraitTotal(core, actorId);
        const teammatePhysicalBefore = physicalTraitTotal(core, teammateId);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXORCISE_JACK,
            actorId,
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(physicalTraitTotal(core, actorId)).toBe(actorPhysicalBefore - 1);
        expect(physicalTraitTotal(core, teammateId)).toBe(teammatePhysicalBefore - 1);
        expect(findTestExplorer(core, teammateId).traits.might).toBe(1);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain(actorId);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain(teammateId);
    });

    it('最终驱魔失败导致全部英雄到死亡边界时才进入叛徒终局', () => {
        let core = createFirstScenarioReadyToExorciseCore();
        const actorId = core.currentExplorer.playerId;
        const teammateId = core.otherExplorers.find((explorer) => explorer.playerId !== core.scenarioRuntime.traitorPlayerId)!.playerId;
        const traitorId = core.scenarioRuntime.traitorPlayerId!;

        setTestExplorerTraits(core, actorId, { might: 2, speed: 4, knowledge: 4, sanity: 4 });
        setTestExplorerTraits(core, teammateId, { might: 2, speed: 4, knowledge: 4, sanity: 4 });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXORCISE_JACK,
            actorId,
            {},
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.outcome).toBe('traitor');
        expect(core.endgameResult?.winners).toEqual([traitorId]);
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(expect.arrayContaining([actorId, teammateId]));
    });

    it('圣符和指环会让驱魔神志检定结果 +1', () => {
        const sanityBonusOmens = [
            { id: 'holy-symbol', name: '圣符', kind: 'omen' as const },
            { id: 'ring', name: '指环', kind: 'omen' as const },
        ];

        for (const omen of sanityBonusOmens) {
            let core = createFirstScenarioHauntCore();
            core.currentExplorer = {
                ...core.currentExplorer,
                roomId: 'upper-north',
                traits: {
                    ...core.currentExplorer.traits,
                    sanity: 4,
                },
                inventory: [omen],
            };
            core.activeRoomId = 'upper-north';
            core.currentExplorerTraits = { ...core.currentExplorer.traits };
            core.currentExplorerInventory = [...core.currentExplorer.inventory];
            core.scenarioRuntime.exorcismCircleRoomIds = ['upper-north', 'upper-west'];
            core.scenarioRuntime.jackSpiritReleased = true;
            core.scenarioRuntime.jackSpiritRoomId = 'upper-north';

            core = applyBetrayalCommand(
                core,
                BETRAYAL_COMMANDS.EXORCISE_JACK,
                '0',
                {},
                100,
                createBetrayalScriptedRandom(2, 2, 2, 2),
            );

            expect(core.activityLog[0]?.text).toContain('杰克之灵被驱散');
            expect(core.endgameResult?.outcome).toBe('survivors');
        }
    });

    it('圣符发现板块时可埋葬第一张板块并继续发现下一张，且不结算第一张效果', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        core.eventOrder = [
            {
                name: '滑落阶梯',
                text: '脚下阶梯突然松动。失去 1 点速度。',
                effect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' },
            },
        ];
        core.roomDiscoveryOrderByFloor.upper = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'mysticElevator')!,
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.upper.find((room) => room.visualId === 'collapsedRoom')!,
        ];
        core.currentExplorer.inventory = [
            { id: 'holy-symbol', name: '圣符', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = ['holy-symbol'];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        const speedBeforeExplore = core.currentExplorer.traits.speed;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'upper-north', useHolySymbol: true },
            100,
            createBetrayalScriptedRandom(1),
        );

        const discoveredRoom = core.rooms.find((room) => room.id === 'upper-north');
        expect(discoveredRoom?.visualId).toBe('mysticElevator');
        expect(discoveredRoom?.endTurnEffect).toBeUndefined();
        expect(discoveredRoom?.enterEffect).toBe('mysticElevator');
        expect(core.latestDiscovery?.kind).toBe('event');
        expect(core.latestDiscovery?.title).toBe('滑落阶梯');
        expect(core.currentExplorer.traits.speed).toBe(speedBeforeExplore - 1);
        expect(core.activityLog[0]?.text).toContain('圣符埋葬倒塌房间');
        expect(core.activityLog[0]?.text).toContain('继续发现神秘电梯');
    });

    it('没有圣符或本回合刚获得圣符时，不能声明埋葬发现板块', () => {
        let core = createStartedFirstScenarioCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });

        const withoutHolySymbol = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north', useHolySymbol: true }),
        );
        expect(withoutHolySymbol.valid).toBe(false);
        if (!withoutHolySymbol.valid) {
            expect(withoutHolySymbol.error).toContain('不能使用圣符');
        }

        core.currentExplorer.inventory = [
            { id: 'holy-symbol', name: '圣符', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.turnStartInventoryCardIds = [];

        const newlyGainedHolySymbol = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north', useHolySymbol: true }),
        );
        expect(newlyGainedHolySymbol.valid).toBe(false);
        if (!newlyGainedHolySymbol.valid) {
            expect(newlyGainedHolySymbol.error).toContain('不能使用圣符');
        }
    });

    it('抽到圣符预兆会记录作祟检定骰面', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['omen'];
        core.possessionOrderByKind.omen = [
            { id: 'holy-symbol', name: '圣符', kind: 'omen' },
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            roomId: 'hallway',
            inventory: [],
        };
        core.activeRoomId = 'hallway';
        core.currentExplorerInventory = [];
        const expectedDiceCount = 1 + [core.currentExplorer, ...core.otherExplorers]
            .reduce((count, explorer) => count + explorer.inventory.filter((card) => card.kind === 'omen').length, 0);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.EXPLORE_ROOM,
            '0',
            { roomId: 'ground-north' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2),
        );

        expect(core.latestDiscovery?.kind).toBe('omen');
        expect(core.latestDiscovery?.title).toBe('圣符');
        expect(core.latestDiscovery?.detail).toContain('作祟检定');
        expect(core.recentRoll?.kind).toBe('hauntRoll');
        expect(core.recentRoll?.sourceTitle).toBe('圣符');
        expect(core.recentRoll?.rollLabel).toBe('作祟检定');
        expect(core.recentRoll?.dice).toEqual(Array.from({ length: expectedDiceCount }, () => 1));
        expect(core.recentRoll?.latestLabel).toBe('未触发作祟');
        expect(core.phase).toBe('preHaunt');
    });

    it('最后一张恶兆会自动触发 haunt', () => {
        const core = createStartedFirstScenarioCore();
        core.exploreIndex = 2;
        core.deckCounts.omen = 1;
        core.currentExplorer.roomId = 'hallway';
        const command = createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {});
        const events = BetrayalDomain.execute({ core, sys: {} as never }, command, createBetrayalScriptedRandom(1));
        const roomExplored = events.find((event) => event.type === 'ROOM_EXPLORED');

        expect(roomExplored?.type).toBe('ROOM_EXPLORED');
        if (roomExplored?.type === 'ROOM_EXPLORED') {
            expect(roomExplored.payload.hauntTriggered).toBe(true);
        }
    });

    it('haunt 阶段即使走本地测试通道也不能继续探索新房间', () => {
        const core = createFirstScenarioHauntCore();
        expect(core.phase).toBe('haunt');
        expect(core.rooms.some((room) => room.state === 'unexplored')).toBe(true);

        const command = {
            ...createBetrayalCommand(BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', {}),
            skipValidation: true,
        };

        expect(BetrayalDomain.validate({ core, sys: {} as never }, command)).toMatchObject({
            valid: false,
            error: 'haunt 阶段不能继续探索新房间。',
        });
    });

    it('翻开未知房间时会把新房间门位旋转到当前开放门位，不再靠黄色连接补丁伪造门', () => {
        const reverseRandom = {
            random: () => 0.42,
            d: (max: number) => Math.max(1, Math.min(max, 1)),
            range: (min: number) => min,
            shuffle: <T,>(array: T[]) => [...array].reverse(),
        };
        let core = BetrayalDomain.setup(['0', '1', '2'], reverseRandom);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.SELECT_EXPLORER, '0', { explorerId: 'jaden-jones' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.CONFIRM_EXPLORER, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.START_SCENARIO, '0', { scenarioId: 'first-scenario' });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' }, 100, createBetrayalScriptedRandom(1));

        const discoveredRoom = core.rooms.find((room) => room.id === 'upper-north');
        expect(discoveredRoom?.entryRoomId).toBe('upper-landing');
        expect(discoveredRoom?.entryEdge).toBe('north');
        expect(discoveredRoom?.doorways.some((doorway) => (
            doorway.edge === 'south' && doorway.connectsToRoomId === 'upper-landing'
        ))).toBe(true);
    });

    it('正式探索会从真实开放门位动态生成下一批未知房间，并在探索后结束当前回合', () => {
        let core = createStartedFirstScenarioCore();

        expect(core.rooms.some((room) => room.id === 'upper-north' && room.state === 'unexplored')).toBe(true);
        expect(core.rooms.some((room) => room.id === 'frontier-upper-north-east')).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'upper-north' }, 100, createBetrayalScriptedRandom(1));

        const discoveredRoom = core.rooms.find((room) => room.id === 'upper-north');
        const dynamicFrontier = core.rooms.find((room) => room.id === 'frontier-upper-north-west');
        expect(discoveredRoom?.state).toBe('discovered');
        expect(dynamicFrontier?.state).toBe('unexplored');
        expect(dynamicFrontier?.doorways).toEqual([
            { edge: 'east', connectsToRoomId: 'upper-north' },
        ]);
        expect(discoveredRoom?.doorways.some((doorway) => (
            doorway.edge === 'west' && doorway.connectsToRoomId === 'frontier-upper-north-west'
        ))).toBe(true);
        expect(core.movesRemaining).toBe(0);
        expect(core.turnEndedByDiscovery).toBe(true);

        const moveAfterDiscovery = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'frontier-upper-north-west' }),
        );
        expect(moveAfterDiscovery.valid).toBe(false);
        if (!moveAfterDiscovery.valid) {
            expect(moveAfterDiscovery.error).toContain('回合已经结束');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.turnEndedByDiscovery).toBe(false);
    });

    it('Stalk the Prey 只能在未攻击且本回合未用过时发动一次，并且不消耗普通移动', () => {
        let core = createFirstScenarioHauntCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.roomId).toBe('basement-east');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'upper-west' });
        expect(core.currentExplorer.roomId).toBe('upper-west');
        expect(core.movesRemaining).toBe(4);
        expect(core.usedCardIdsThisTurn).toContain('stalk-the-prey');

        const secondStalkValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'entrance-hall' }),
        );
        expect(secondStalkValidation.valid).toBe(false);

        let afterAttackCore = createFirstScenarioHauntCore();
        afterAttackCore.currentPlayer = '2';
        const traitor = afterAttackCore.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const hero = afterAttackCore.currentExplorer;
        afterAttackCore.currentExplorer = { ...traitor, roomId: 'hallway' };
        afterAttackCore.otherExplorers = [
            { ...hero, roomId: 'hallway' },
            ...afterAttackCore.otherExplorers.filter((explorer) => explorer.playerId !== '2'),
        ];
        afterAttackCore.activeRoomId = 'hallway';
        afterAttackCore.currentExplorerTraits = { ...afterAttackCore.currentExplorer.traits };
        afterAttackCore.currentExplorerInventory = [...afterAttackCore.currentExplorer.inventory];
        afterAttackCore = applyBetrayalCommand(
            afterAttackCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const afterAttackValidation = BetrayalDomain.validate(
            { core: afterAttackCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'entrance-hall' }),
        );
        expect(afterAttackValidation.valid).toBe(false);
    });

    it('叛徒死亡后轮到其回合时，应改为操控杰克之灵按相邻房间移动', () => {
        let core = createFirstScenarioHauntCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );

        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.currentPlayer).toBe('1');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.END_TURN,
            '1',
            {},
            100,
            createBetrayalScriptedRandom(2, 2, 1),
        );

        expect(core.currentPlayer).toBe('2');
        expect(core.activeRoomId).toBe(core.scenarioRuntime.jackSpiritRoomId);
        expect(core.movesRemaining).toBe(2);

        const moveTargets = ['hallway', 'basement-landing', 'basement-east'].map((roomId) => (
            BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId }),
            ).valid
        ));
        expect(moveTargets).toEqual([true, true, false]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });

        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-landing');
        expect(core.activeRoomId).toBe('basement-landing');
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')?.roomId).toBe('basement-landing');
    });

    it('英雄攻击叛徒时应按对攻差值造成 physical damage，平手无伤害，Knowledge of Jack 只在此时加成', () => {
        let tieCore = createFirstScenarioHauntCore();
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        tieCore = applyBetrayalCommand(tieCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        const traitorBeforeTie = tieCore.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const heroBeforeTie = { ...tieCore.currentExplorer.traits };
        tieCore = applyBetrayalCommand(
            tieCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const traitorAfterTie = tieCore.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(tieCore.scenarioRuntime.jackSpiritReleased).toBe(false);
        expect(tieCore.currentExplorer.traits).toEqual(heroBeforeTie);
        expect(traitorAfterTie.traits).toEqual(traitorBeforeTie.traits);

        let bonusCore = createFirstScenarioHauntCore();
        bonusCore.scenarioRuntime.knowledgeOfJackPlayerIds = ['0'];
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        bonusCore = applyBetrayalCommand(bonusCore, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        bonusCore = applyBetrayalCommand(
            bonusCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );

        expect(bonusCore.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(bonusCore.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
    });

    it('兔脚可以重掷刚刚攻击投骰的一颗骰子，并按新结果回算非致死攻击伤害', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'rope', name: '兔脚', kind: 'item' },
        ];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'rope'];

        const heroBeforeAttack = { ...core.currentExplorer.traits };
        const traitorBeforeAttack = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 2, 2, 2, 2, 2, 2, 2, 1),
        );

        const heroAfterFailedAttack = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        const traitorAfterFailedAttack = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(core.recentRoll?.kind).toBe('attackRoll');
        expect(core.recentRoll?.playerId).toBe('0');
        expect(heroAfterFailedAttack.traits.might + heroAfterFailedAttack.traits.speed).toBeLessThan(
            heroBeforeAttack.might + heroBeforeAttack.speed,
        );
        expect(traitorAfterFailedAttack.traits).toEqual(traitorBeforeAttack.traits);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 0 }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.USE_RABBIT_FOOT,
            '0',
            { cardId: 'rope', dieIndex: 0 },
            101,
            createBetrayalScriptedRandom(3),
        );

        const heroAfterReroll = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        const traitorAfterReroll = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(heroAfterReroll.traits).toEqual(heroBeforeAttack);
        expect(traitorAfterReroll.traits.might + traitorAfterReroll.traits.speed).toBeLessThan(
            traitorBeforeAttack.traits.might + traitorBeforeAttack.traits.speed,
        );
        expect(core.recentRoll?.latestLabel).toContain('造成');
        expect(core.usedCardIdsThisTurn).toContain('rope');

        const useAgain = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_RABBIT_FOOT, '0', { cardId: 'rope', dieIndex: 1 }),
        );
        expect(useAgain.valid).toBe(false);
    });

    it('砍刀只能作为攻击武器显式使用，攻击结果 +1 且本回合不能交易', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'hunting-knife', name: '砍刀', kind: 'item' },
        ];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'hunting-knife'];

        const useAsGenericPossession = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'hunting-knife' }),
        );
        expect(useAsGenericPossession.valid).toBe(false);
        const traitorBeforeAttack = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'hunting-knife' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        expect(core.usedCardIdsThisTurn).toContain('hunting-knife');
        expect(core.activityLog[0]?.text).toContain('使用砍刀');
        const traitorAfterAttack = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(traitorAfterAttack.traits.might + traitorAfterAttack.traits.speed).toBeLessThan(
            traitorBeforeAttack.traits.might + traitorBeforeAttack.traits.speed,
        );

        const tradeCore = createFirstScenarioHauntCore();
        tradeCore.currentExplorer = {
            ...tradeCore.currentExplorer,
            roomId: 'hallway',
            inventory: [{ id: 'hunting-knife', name: '砍刀', kind: 'item' }],
        };
        tradeCore.otherExplorers = tradeCore.otherExplorers.map((explorer) => (
            explorer.playerId === '1' ? { ...explorer, roomId: 'hallway' } : explorer
        ));
        tradeCore.usedCardIdsThisTurn = ['hunting-knife'];
        const tradeUsedWeapon = BetrayalDomain.validate(
            { core: tradeCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                cardId: 'hunting-knife',
                targetPlayerId: '1',
            }),
        );
        expect(tradeUsedWeapon.valid).toBe(false);
        expect(tradeUsedWeapon.error).toContain('本回合已经使用过的持有物不能交易');
    });

    it('未声明使用砍刀时，不会只因持有武器自动获得攻击 +1', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'hunting-knife', name: '砍刀', kind: 'item' },
        ];
        const heroBefore = { ...core.currentExplorer.traits };
        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const traitorAfter = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(core.currentExplorer.traits).toEqual(heroBefore);
        expect(traitorAfter.traits).toEqual(traitorBefore.traits);
        expect(core.usedCardIdsThisTurn).not.toContain('hunting-knife');
    });

    it('匕首只能作为攻击武器显式使用，会失去 1 点速度并额外投 2 颗骰', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'dagger', name: '匕首', kind: 'omen' },
        ];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'dagger'];

        const useAsGenericPossession = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'dagger' }),
        );
        expect(useAsGenericPossession.valid).toBe(false);

        const heroSpeedBefore = core.currentExplorer.traits.speed;
        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const traitorPhysicalBefore = traitorBefore.traits.might + traitorBefore.traits.speed;
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'dagger' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 3, 1, 1, 1),
        );

        expect(core.usedCardIdsThisTurn).toContain('dagger');
        expect(core.activityLog[0]?.text).toContain('使用匕首');
        const attackerAfterDagger = core.currentExplorer.playerId === '0'
            ? core.currentExplorer
            : core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(attackerAfterDagger.traits.speed).toBe(heroSpeedBefore - 1);
        const traitorAfter = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(traitorAfter.traits.might + traitorAfter.traits.speed).toBeLessThan(traitorPhysicalBefore);
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);
    });

    it('未声明使用匕首时，不会只因持有武器自动额外投骰或失去速度', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'dagger', name: '匕首', kind: 'omen' },
        ];
        const heroBefore = { ...core.currentExplorer.traits };
        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const traitorAfter = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(core.currentExplorer.traits).toEqual(heroBefore);
        expect(traitorAfter.traits).toEqual(traitorBefore.traits);
        expect(core.usedCardIdsThisTurn).not.toContain('dagger');
    });

    it('指环只能作为攻击武器显式使用，双方改用神志对攻并造成精神伤害', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'ring', name: '指环', kind: 'omen' },
        ];
        core.turnStartInventoryCardIds = [...core.turnStartInventoryCardIds, 'ring'];

        const useAsGenericPossession = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_POSSESSION, '0', { cardId: 'ring' }),
        );
        expect(useAsGenericPossession.valid).toBe(false);

        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        const traitorPhysicalBefore = traitorBefore.traits.might + traitorBefore.traits.speed;
        const traitorMentalBefore = traitorBefore.traits.knowledge + traitorBefore.traits.sanity;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor', weaponCardId: 'ring' },
            100,
            createBetrayalScriptedRandom(2, 1, 1, 1, 1, 1, 1, 1),
        );

        expect(core.usedCardIdsThisTurn).toContain('ring');
        expect(core.activityLog[0]?.text).toContain('使用指环');
        expect(core.activityLog[0]?.text).toContain('mental damage');
        const traitorAfter = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(traitorAfter.traits.might + traitorAfter.traits.speed).toBe(traitorPhysicalBefore);
        expect(traitorAfter.traits.knowledge + traitorAfter.traits.sanity).toBeLessThan(traitorMentalBefore);
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);
    });

    it('未声明使用指环时，不会只因持有武器自动改用神志或造成精神伤害', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'ring', name: '指环', kind: 'omen' },
        ];
        const heroBefore = { ...core.currentExplorer.traits };
        const traitorBefore = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(1, 1, 1, 1, 1, 1),
        );

        const traitorAfter = core.otherExplorers.find((explorer) => explorer.playerId === '2')!;
        expect(core.currentExplorer.traits).toEqual(heroBefore);
        expect(traitorAfter.traits).toEqual(traitorBefore.traits);
        expect(core.usedCardIdsThisTurn).not.toContain('ring');
    });

    it('死叛徒回合攻击英雄时应按 Jack’s Spirit 的房间和数值行动', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.activeRoomId).toBe(core.scenarioRuntime.jackSpiritRoomId);

        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'ground-north' }
                : explorer
        ));
        const attackValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HAUNT_ATTACK, '2', { target: 'hero' }),
        );
        expect(attackValidation.valid).toBe(false);

        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: core.scenarioRuntime.jackSpiritRoomId! }
                : explorer
        ));
        const hero = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1),
        );

        const updatedHero = core.currentExplorer.playerId === '0'
            ? core.currentExplorer
            : core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(updatedHero.traits.might + updatedHero.traits.speed).toBeLessThan(hero.traits.might + hero.traits.speed);
    });

    it('英雄持有 Knowledge of Jack 时，被 Jack’s Spirit 攻击也应获得 +2 防御加成', () => {
        let withoutBonus = createFirstScenarioHauntCore();
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        withoutBonus = applyBetrayalCommand(
            withoutBonus,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );
        withoutBonus = applyBetrayalCommand(withoutBonus, BETRAYAL_COMMANDS.END_TURN, '1', {}, 100, createBetrayalScriptedRandom(2, 2, 1));
        const noBonusHeroBefore = withoutBonus.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        withoutBonus = applyBetrayalCommand(
            withoutBonus,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 2, 2, 1, 1, 1),
        );
        const noBonusHeroAfter = withoutBonus.currentExplorer.playerId === '0'
            ? withoutBonus.currentExplorer
            : withoutBonus.otherExplorers.find((explorer) => explorer.playerId === '0')!;

        let withBonus = createFirstScenarioHauntCore();
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        withBonus = applyBetrayalCommand(
            withBonus,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );
        withBonus.scenarioRuntime.knowledgeOfJackPlayerIds = ['0'];
        withBonus = applyBetrayalCommand(withBonus, BETRAYAL_COMMANDS.END_TURN, '1', {}, 100, createBetrayalScriptedRandom(2, 2, 1));
        const bonusHeroBefore = withBonus.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        withBonus = applyBetrayalCommand(
            withBonus,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'hero', targetPlayerId: '0' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 2, 2, 1, 1, 1),
        );
        const bonusHeroAfter = withBonus.currentExplorer.playerId === '0'
            ? withBonus.currentExplorer
            : withBonus.otherExplorers.find((explorer) => explorer.playerId === '0')!;

        const noBonusLoss = (noBonusHeroBefore.traits.might + noBonusHeroBefore.traits.speed)
            - (noBonusHeroAfter.traits.might + noBonusHeroAfter.traits.speed);
        const bonusLoss = (bonusHeroBefore.traits.might + bonusHeroBefore.traits.speed)
            - (bonusHeroAfter.traits.might + bonusHeroAfter.traits.speed);

        expect(noBonusLoss).toBeGreaterThan(bonusLoss);
    });

    it('Jack’s Spirit 回到尸体房间后，应在怪物回合开始时复活叛徒并移除 spirit', () => {
        let core = createFirstScenarioHauntCore();
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'upper-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'grand-staircase' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-landing' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'basement-east' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'traitor' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1, 1),
        );
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {}, 100, createBetrayalScriptedRandom(2, 2, 1));

        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.recentRoll?.kind).toBe('monsterMoveRoll');
        expect(core.recentRoll?.dice).toEqual([1, 1, 0]);
        expect(core.movesRemaining).toBe(2);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' });
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-landing');
        expect(core.scenarioRuntime.traitorCorpseRoomId).toBe('basement-east');
        expect(core.movesRemaining).toBe(1);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-east' });
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-east');
        expect(core.movesRemaining).toBe(0);

        const moveAfterAllowanceSpent = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '2', { roomId: 'basement-landing' }),
        );
        expect(moveAfterAllowanceSpent.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});

        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBeNull();
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')).toBeUndefined();
        expect(core.currentExplorer.playerId).toBe('2');
        expect(core.currentExplorer.traits.might).toBeGreaterThan(1);
        const template = EXPLORER_CATALOG.find((explorer) => explorer.explorerId === core.currentExplorer.explorerId)!;
        expect(core.currentExplorer.traits.might).toBe(template.traits.might);
        expect(core.currentExplorer.traits.speed).toBe(template.traits.speed);
    });

    it('同房间尸体上的 Item/Omen 应可每回合搜刮 1 件，且同一尸体同回合不能连续搜刮', () => {
        let core = createCorpseLootReadyCore();

        const missingCardValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0' }),
        );
        expect(missingCardValidation.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0', cardId: 'corpse-item-1' });

        const lootedByTeammate = core.currentExplorer.playerId === '1'
            ? core.currentExplorer
            : core.otherExplorers.find((explorer) => explorer.playerId === '1')!;
        const corpseAfterLoot = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;

        expect(lootedByTeammate.inventory.length).toBeGreaterThan(1);
        expect(corpseAfterLoot.inventory).toHaveLength(1);
        expect(core.scenarioRuntime.corpseLootedByPlayerIdsThisTurn).toContain('0');

        const secondLootValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0', cardId: 'corpse-omen-1' }),
        );
        expect(secondLootValidation.valid).toBe(false);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
        expect(core.currentPlayer).toBe('1');

        const nextTurnLootValidation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.LOOT_CORPSE, '1', { sourcePlayerId: '0', cardId: 'corpse-omen-1' }),
        );
        expect(nextTurnLootValidation.valid).toBe(true);
    });

    it('搜尸前置态应把真实页面停在可点击正式搜尸动作的运行时', () => {
        const core = createCorpseLootReadyCore();

        expect(core.phase).toBe('haunt');
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.playerId).toBe('1');
        expect(core.activeRoomId).toBe('hallway');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toEqual(['0']);
        expect(core.recommendedAction).toBe('trade');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.inventory).toHaveLength(2);
    });

    it('杰克之灵复活前置态应停在只差结束当前回合就会复活叛徒的运行时', () => {
        const core = createJackSpiritReviveReadyCore();

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.currentPlayer).toBe('1');
        expect(core.currentExplorer.playerId).toBe('1');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(true);
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('basement-east');
        expect(core.scenarioRuntime.traitorCorpseRoomId).toBe('basement-east');
        expect(core.scenarioRuntime.jackSpiritHasMovedSinceRelease).toBe(true);
        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')?.roomId).toBe('basement-east');
    });

    it('叛徒复活后的前置态应停在同房间可直接攻击英雄的运行时', () => {
        const core = createJackSpiritPostReviveAttackReadyCore();

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(core.currentPlayer).toBe('2');
        expect(core.currentExplorer.playerId).toBe('2');
        expect(core.activeRoomId).toBe('basement-east');
        expect(core.scenarioRuntime.deadExplorerPlayerIds).not.toContain('2');
        expect(core.scenarioRuntime.jackSpiritReleased).toBe(false);
        expect(core.currentExplorer.roomId).toBe('basement-east');
        expect(core.otherExplorers.find((explorer) => explorer.playerId === '0')?.roomId).toBe('basement-east');
        expect(core.recommendedAction).toBe('move');
    });
});
