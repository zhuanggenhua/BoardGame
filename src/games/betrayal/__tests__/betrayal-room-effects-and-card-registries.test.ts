import { describe, expect, it } from 'vitest';
import {
    applyBetrayalCommand,
    BETRAYAL_FIXED_RANDOM,
    createBetrayalCommand,
    createStartedFirstScenarioCore,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    resolveAttackWeaponCardStatuses,
    resolveBetrayalDeathStateSummary,
    resolveCorpseLootTargets,
    resolveUseEffect,
    canUseHolySymbolForDiscovery,
    canUseIdolToSkipEvent,
    BETRAYAL_DISCOVERY_POOLS,
    isBetrayalEventRuntimeSupported,
    EVENT_FRONT_FRAME_BY_TITLE,
    findTestExplorer,
    setTestExplorerInventory,
    setNextDiscoverySymbolRoomsForAllFloors,
    setTestTraitTrack,
    traitTrackPosition,
    acknowledgeAnyPendingCardResolutions,
    collectEventTemplateDeathRiskTags,
    collectEventTemplateEffectModes,
    collectRuntimePossessionCards,
    createPossessionCoverageCore,
    createDustTradeAndCorpseLootReadyCore,
} from './helpers/firstScenarioRuntimeHarness';

describe('Betrayal first scenario runtime - room effects and card registries', () => {
it('火炉房在探索者结束回合时要求受伤玩家分配 1 点物理伤害', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!,
        ];
        const speedBefore = core.currentExplorer.traits.speed;
        const speedPositionBefore = core.currentExplorer.traitTracks.speed.position;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        expect(core.rooms.find((room) => room.id === 'ground-north')?.name).toBe('火炉房');
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '火炉房',
            damageKind: 'physical',
            amount: 1,
            allowedTraits: ['might', 'speed'],
            playerId: '0',
        });
        expect(core.currentPlayer).toBe('0');
        expect(core.activePlayerId).toBe('0');

        const blockedMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_TO_ROOM, '1', { roomId: 'hallway' }),
        );
        expect(blockedMove).toMatchObject({ valid: false, error: '请先分配当前伤害。' });

        const wrongPlayer = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '1', { traits: ['speed'] }),
        );
        expect(wrongPlayer).toMatchObject({ valid: false, error: '必须由受伤玩家分配伤害。' });

        const wrongTrait = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['knowledge'] }),
        );
        expect(wrongTrait).toMatchObject({ valid: false, error: '该伤害不能分配到所选属性。' });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['speed'] });

        const damagedExplorer = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(damagedExplorer.traitTracks.speed.position).toBe(speedPositionBefore - 1);
        expect(damagedExplorer.traits.speed).toBe(speedBefore - 1);
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.currentPlayer).toBe('1');
        expect(core.activityLog[0]?.text).toContain('分配');
        expect(core.activityLog[0]?.text).toContain('火炉房');
    });

it('胸针可以把物理伤害替换为通用伤害后分配到任意属性', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!,
        ];
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'brooch', name: '胸针', kind: 'item' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        const knowledgePositionBefore = core.currentExplorer.traitTracks.knowledge.position;
        const speedPositionBefore = core.currentExplorer.traitTracks.speed.position;

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = acknowledgeAnyPendingCardResolutions(core);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '火炉房',
            damageKind: 'physical',
            amount: 1,
            damageReplacement: {
                kind: 'brooch-general-damage',
                cardId: 'brooch',
                cardName: '胸针',
            },
        });

        const withoutBrooch = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['knowledge'] }),
        );
        expect(withoutBrooch).toMatchObject({ valid: false, error: '该伤害不能分配到所选属性。' });

        const withBrooch = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['knowledge'], useBrooch: true }),
        );
        expect(withBrooch).toMatchObject({ valid: true });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: ['knowledge'], useBrooch: true },
        );

        const damagedExplorer = findTestExplorer(core, '0');
        expect(damagedExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBefore - 1);
        expect(damagedExplorer.traitTracks.speed.position).toBe(speedPositionBefore);
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.activityLog[0]?.text).toContain('使用胸针');
        expect(core.activityLog[0]?.text).toContain('替换为通用伤害');
    });

it('胸针可以把精神伤害替换为通用伤害', () => {
        let core = createStartedFirstScenarioCore();
        core.currentExplorer = {
            ...core.currentExplorer,
            inventory: [{ id: 'brooch', name: '胸针', kind: 'item' }],
        };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        const explorer = findTestExplorer(core, '0');
        const speedPositionBefore = explorer.traitTracks.speed.position;
        const knowledgePositionBefore = explorer.traitTracks.knowledge.position;
        const sanityPositionBefore = explorer.traitTracks.sanity.position;
        core.pendingDamageAllocation = {
            id: 'mental-brooch-test',
            playerId: '0',
            sourceTitle: '测试精神伤害',
            damageKind: 'mental',
            amount: 1,
            originalAmount: 1,
            allowedTraits: ['knowledge', 'sanity'],
            damageReplacement: {
                kind: 'brooch-general-damage',
                cardId: 'brooch',
                cardName: '胸针',
            },
            allowSkull: false,
            traitsBeforeDamage: { ...explorer.traits },
        };

        const withoutBrooch = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['speed'] }),
        );
        expect(withoutBrooch).toMatchObject({ valid: false, error: '该伤害不能分配到所选属性。' });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '0',
            { traits: ['speed'], useBrooch: true },
        );

        const damagedExplorer = findTestExplorer(core, '0');
        expect(damagedExplorer.traitTracks.speed.position).toBe(speedPositionBefore - 1);
        expect(damagedExplorer.traitTracks.knowledge.position).toBe(knowledgePositionBefore);
        expect(damagedExplorer.traitTracks.sanity.position).toBe(sanityPositionBefore);
        expect(core.pendingDamageAllocation).toBeNull();
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
        expect(core.pendingCardResolutionQueue).toHaveLength(2);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            cardName: '房间效果：礼拜堂，神志 +1',
            stepKind: 'room-effect',
            text: '房间效果：礼拜堂，神志 +1',
            index: 1,
            total: 2,
        });
        expect(core.pendingCardResolutionQueue[0]?.deckKind).toBeUndefined();
        expect(core.pendingCardResolutionQueue[1]).toMatchObject({
            deckKind: 'event',
            stepKind: 'event-effect',
            index: 2,
            total: 2,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });
        core = acknowledgeAnyPendingCardResolutions(core);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        ).valid).toBe(true);
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
        core = acknowledgeAnyPendingCardResolutions(core);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        const armoredExplorer = core.otherExplorers.find((explorer) => explorer.playerId === '0')!;
        expect(core.pendingDamageAllocation).toBeNull();
        expect(armoredExplorer.traits.might).toBe(mightBefore);
        expect(armoredExplorer.traits.speed).toBe(speedBefore);
        expect(core.currentPlayer).toBe('1');
    });

it('火炉房伤害不能分配到作祟前已临界的物理属性', () => {
        let core = createStartedFirstScenarioCore();
        setTestTraitTrack(core, '0', 'might', [1, 2, 3], 0, 1);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3], 2, 1);
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!,
        ];

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = acknowledgeAnyPendingCardResolutions(core);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});

        const lockedMight = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['might'] }),
        );
        expect(lockedMight).toMatchObject({ valid: false, error: '不能把伤害分配到已锁定的属性。' });

        const validSpeed = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['speed'] }),
        );
        expect(validSpeed).toMatchObject({ valid: true });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['speed'] });

        const explorer = findTestExplorer(core, '0');
        expect(explorer.traitTracks.might.position).toBe(0);
        expect(explorer.traitTracks.speed.position).toBe(1);
        expect(core.currentPlayer).toBe('1');
    });

it('盔甲不会阻挡对力量属性的直接降低', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
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

it('奇异护符在实际承受物理伤害后获得 1 点神志', () => {
        let core = createStartedFirstScenarioCore();
        core.roomDiscoveryOrderByFloor.ground = [
            BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor.ground.find((room) => room.visualId === 'furnaceRoom')!,
        ];
        setTestExplorerInventory(core, '0', [{ id: 'strange-amulet', name: '奇异护符', kind: 'item' }]);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3], 1, 1);
        setTestTraitTrack(core, '0', 'sanity', [1, 2, 3], 1, 1);
        const speedPositionBefore = traitTrackPosition(core, '0', 'speed');
        const sanityPositionBefore = traitTrackPosition(core, '0', 'sanity');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = acknowledgeAnyPendingCardResolutions(core);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['speed'] });

        expect(traitTrackPosition(core, '0', 'speed')).toBe(speedPositionBefore - 1);
        expect(traitTrackPosition(core, '0', 'sanity')).toBe(sanityPositionBefore + 1);
        expect(core.pendingDamageAllocation).toBeNull();
        expect(core.activityLog[0]?.text).toContain('奇异护符使神志 +1');
    });

it('奇异护符不会因通用伤害分配到速度而获得神志', () => {
        let core = createStartedFirstScenarioCore();
        setTestExplorerInventory(core, '0', [{ id: 'strange-amulet', name: '奇异护符', kind: 'item' }]);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3], 1, 1);
        setTestTraitTrack(core, '0', 'sanity', [1, 2, 3], 1, 1);
        const explorer = findTestExplorer(core, '0');
        const speedPositionBefore = traitTrackPosition(core, '0', 'speed');
        const sanityPositionBefore = traitTrackPosition(core, '0', 'sanity');
        core.pendingDamageAllocation = {
            id: 'strange-amulet-general-damage-test',
            playerId: '0',
            sourceTitle: '测试通用伤害',
            damageKind: 'general',
            amount: 1,
            originalAmount: 1,
            allowedTraits: ['might', 'speed', 'knowledge', 'sanity'],
            allowSkull: false,
            traitsBeforeDamage: { ...explorer.traits },
        };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, '0', { traits: ['speed'] });

        expect(traitTrackPosition(core, '0', 'speed')).toBe(speedPositionBefore - 1);
        expect(traitTrackPosition(core, '0', 'sanity')).toBe(sanityPositionBefore);
        expect(core.pendingDamageAllocation).toBeNull();
    });

it('奇异护符不会因速度属性直接降低而获得神志', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [{
            name: '奇异护符直接降速测试',
            text: '失去 1 点速度。',
            effect: { mode: 'trait', trait: 'speed', amount: -1, recommendedAction: 'endTurn' },
        }];
        setTestExplorerInventory(core, '0', [{ id: 'strange-amulet', name: '奇异护符', kind: 'item' }]);
        setTestTraitTrack(core, '0', 'speed', [1, 2, 3], 1, 1);
        setTestTraitTrack(core, '0', 'sanity', [1, 2, 3], 1, 1);
        const speedPositionBefore = traitTrackPosition(core, '0', 'speed');
        const sanityPositionBefore = traitTrackPosition(core, '0', 'sanity');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.kind).toBe('event');
        expect(traitTrackPosition(core, '0', 'speed')).toBe(speedPositionBefore - 1);
        expect(traitTrackPosition(core, '0', 'sanity')).toBe(sanityPositionBefore);
    });

it('首剧本事件牌池使用已锁定的官方事件牌，不再沿用项目占位事件', () => {
        const eventNames = BETRAYAL_DISCOVERY_POOLS.events.map((event) => event.name);
        expect(eventNames).toEqual([
            '标本剥制',
            '说“茄子”！',
            '外星几何',
            '小丑房间',
            '咬一口！',
            '吊死鬼',
            '电话铃声',
            '小机器人',
            '嘎吱的木门',
            '脑状食品',
            '片刻希望',
            '上古旧宅',
            '肉质苔癣',
            '夜幕众星',
            '一抹鲜红',
            '一瓶微尘',
            '大宅饿了',
            '一条秘密通道',
            '最深的壁橱',
            '磁带播放器',
            '在你背后！',
            '蜘蛛！',
            '一种怪异的感觉',
            '游魂',
            '葬礼',
            '不可能的房间',
            '地狱蝙蝠',
            '断手',
            '怪异的镜子',
            '花团锦簇',
            '晦暗暴风夜',
            '技术难点',
            '佳馔满桌',
            '禁忌知识',
            '可怜的尤里克',
            '轮到约拿了',
            '秘密升降机',
            '神秘液体',
            '无线电广播',
            '摇曳灯光',
            '一罐器官',
            '一声呼救',
            '着火的人',
        ]);
        expect(eventNames).not.toContain('回廊顺风');
        expect(eventNames).not.toContain('窃窃低语');
        expect(eventNames).not.toContain('旧日手记');
        expect(eventNames).not.toContain('滑落阶梯');
        expect(eventNames).not.toContain('墙中低语');
        expect(eventNames).not.toContain('冷风指路');
        expect(eventNames).not.toContain('阴影扑面');
        expect(eventNames).not.toContain('残留祝福');
    });

it('正式运行事件牌堆只包含当前已接入运行切片的事件', () => {
        const supportedEventNames = BETRAYAL_DISCOVERY_POOLS.events
            .filter(isBetrayalEventRuntimeSupported)
            .map((event) => event.name);
        const unsupportedEventNames = BETRAYAL_DISCOVERY_POOLS.events
            .filter((event) => !isBetrayalEventRuntimeSupported(event))
            .map((event) => event.name);
        const core = BetrayalDomain.setup(['0', '1', '2'], BETRAYAL_FIXED_RANDOM);

        expect(unsupportedEventNames).toEqual([]);
        expect(supportedEventNames).toContain('一抹鲜红');
        expect(supportedEventNames).toContain('一瓶微尘');
        expect(supportedEventNames).toContain('说“茄子”！');
        expect(supportedEventNames).toContain('大宅饿了');
        expect(core.eventOrder.map((event) => event.name).sort()).toEqual(supportedEventNames.sort());
        expect(core.eventOrder.map((event) => event.name)).toContain('大宅饿了');
        expect(core.deckCounts.event).toBe(supportedEventNames.length);
        expect(core.deckCounts.event).toBe(core.eventOrder.length);
    });

it('当前 43 张事件牌都有事件正面 atlas 映射', () => {
        const expectedFrameByEventName: Record<string, number> = {
            标本剥制: 0,
            '说“茄子”！': 23,
            外星几何: 24,
            小丑房间: 26,
            '咬一口！': 29,
            吊死鬼: 6,
            电话铃声: 5,
            小机器人: 27,
            嘎吱的木门: 8,
            脑状食品: 18,
            片刻希望: 19,
            上古旧宅: 21,
            肉质苔癣: 20,
            夜幕众星: 30,
            一抹鲜红: 32,
            一瓶微尘: 33,
            大宅饿了: 3,
            一条秘密通道: 35,
            最深的壁橱: 42,
            磁带播放器: 2,
            '在你背后！': 38,
            '蜘蛛！': 41,
            一种怪异的感觉: 36,
            游魂: 37,
            葬礼: 39,
            不可能的房间: 1,
            地狱蝙蝠: 4,
            断手: 7,
            怪异的镜子: 9,
            花团锦簇: 10,
            晦暗暴风夜: 11,
            技术难点: 12,
            佳馔满桌: 13,
            禁忌知识: 14,
            可怜的尤里克: 15,
            轮到约拿了: 16,
            秘密升降机: 17,
            神秘液体: 22,
            无线电广播: 25,
            摇曳灯光: 28,
            一罐器官: 31,
            一声呼救: 34,
            着火的人: 40,
        };
        const actualFrameByEventName = Object.fromEntries(
            BETRAYAL_DISCOVERY_POOLS.events.map((event) => [
                event.name,
                EVENT_FRONT_FRAME_BY_TITLE[event.name],
            ]),
        );

        expect(Object.keys(expectedFrameByEventName)).toEqual(
            BETRAYAL_DISCOVERY_POOLS.events.map((event) => event.name),
        );
        expect(actualFrameByEventName).toEqual(expectedFrameByEventName);
    });

it('当前 43 张事件牌都登记了灰尘死亡保护风险分类', () => {
        const expectedRiskTagsByEventName: Record<string, string[]> = {
            标本剥制: ['damage'],
            '说“茄子”！': [],
            外星几何: ['directTraitLoss'],
            小丑房间: ['damage'],
            '咬一口！': ['damage'],
            吊死鬼: ['directTraitLoss'],
            电话铃声: ['damage'],
            小机器人: ['damage'],
            嘎吱的木门: [],
            脑状食品: ['damage', 'directTraitLoss'],
            片刻希望: [],
            上古旧宅: ['damage'],
            肉质苔癣: ['damage'],
            夜幕众星: ['directTraitLoss'],
            一抹鲜红: ['damage'],
            一瓶微尘: ['directTraitLoss'],
            大宅饿了: [],
            一条秘密通道: ['directTraitLoss'],
            最深的壁橱: ['damage'],
            磁带播放器: ['damage'],
            '在你背后！': ['damage'],
            '蜘蛛！': ['directTraitLoss'],
            一种怪异的感觉: ['directTraitLoss'],
            游魂: ['damage'],
            葬礼: ['directTraitLoss'],
            不可能的房间: ['damage'],
            地狱蝙蝠: ['damage'],
            断手: ['damage'],
            怪异的镜子: [],
            花团锦簇: ['damage'],
            晦暗暴风夜: ['damage'],
            技术难点: ['damage'],
            佳馔满桌: ['damage'],
            禁忌知识: ['damage', 'directTraitLoss'],
            可怜的尤里克: ['damage'],
            轮到约拿了: ['damage'],
            秘密升降机: [],
            神秘液体: ['directTraitLoss'],
            无线电广播: ['damage'],
            摇曳灯光: ['damage'],
            一罐器官: ['directTraitLoss'],
            一声呼救: ['damage'],
            着火的人: ['damage'],
        };
        const actualRiskTagsByEventName = Object.fromEntries(
            BETRAYAL_DISCOVERY_POOLS.events.map((event) => [
                event.name,
                collectEventTemplateDeathRiskTags(event),
            ]),
        );

        expect(Object.keys(expectedRiskTagsByEventName)).toEqual(
            BETRAYAL_DISCOVERY_POOLS.events.map((event) => event.name),
        );
        expect(actualRiskTagsByEventName).toEqual(expectedRiskTagsByEventName);
    });

it('当前运行持有牌全集覆盖发现牌池，并登记主动/武器能力', () => {
        const discoveryCardIds = new Set([
            ...BETRAYAL_DISCOVERY_POOLS.possessions.item,
            ...BETRAYAL_DISCOVERY_POOLS.possessions.omen,
        ].map((card) => card.id));
        const runtimeCards = collectRuntimePossessionCards();
        const core = createPossessionCoverageCore();
        const attackWeaponCardIds = new Set(resolveAttackWeaponCardStatuses(core).map((status) => status.card.id));
        const actualCoverage = Object.fromEntries(runtimeCards.map((card) => [
            card.id,
            {
                name: card.name,
                kind: card.kind,
                activeUseMode: resolveUseEffect(card)?.mode ?? null,
                attackWeapon: attackWeaponCardIds.has(card.id),
            },
        ]));

        expect(BETRAYAL_DISCOVERY_POOLS.possessions.item).toHaveLength(22);
        expect(BETRAYAL_DISCOVERY_POOLS.possessions.omen).toHaveLength(9);
        expect(runtimeCards.map((card) => card.id)).toEqual([
            'camera',
            'scary-doll',
            'medical-kit',
            'mirror',
            'holy-water',
            'lucky-coin',
            'leather-jacket',
            'tooth-necklace',
            'flashlight',
            'radio',
            'map',
            'strange-amulet',
            'brooch',
            'gun',
            'crossbow',
            'rope',
            'lockpick-tool',
            'mysterious-stopwatch',
            'hunting-knife',
            'chainsaw',
            'dynamite',
            'angel-feather',
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
        expect(runtimeCards.filter((card) => !discoveryCardIds.has(card.id)).map((card) => card.name)).toEqual([]);
        expect(actualCoverage).toEqual({
            camera: { name: '魔法相机', kind: 'item', activeUseMode: null, attackWeapon: false },
            'scary-doll': { name: '恐怖玩偶', kind: 'item', activeUseMode: null, attackWeapon: false },
            'medical-kit': { name: '急救包', kind: 'item', activeUseMode: 'healTraits', attackWeapon: false },
            mirror: { name: '镜子', kind: 'item', activeUseMode: 'healTraits', attackWeapon: false },
            'holy-water': { name: '奇怪的药品', kind: 'item', activeUseMode: 'healTraits', attackWeapon: false },
            'lucky-coin': { name: '幸运硬币', kind: 'item', activeUseMode: null, attackWeapon: false },
            'leather-jacket': { name: '皮夹克', kind: 'item', activeUseMode: null, attackWeapon: false },
            'tooth-necklace': { name: '牙齿项链', kind: 'item', activeUseMode: null, attackWeapon: false },
            flashlight: { name: '手电筒', kind: 'item', activeUseMode: null, attackWeapon: false },
            radio: { name: '头戴耳机', kind: 'item', activeUseMode: null, attackWeapon: false },
            map: { name: '地图', kind: 'item', activeUseMode: 'placeExplorer', attackWeapon: false },
            'strange-amulet': { name: '奇异护符', kind: 'item', activeUseMode: null, attackWeapon: false },
            brooch: { name: '胸针', kind: 'item', activeUseMode: null, attackWeapon: false },
            gun: { name: '枪', kind: 'item', activeUseMode: null, attackWeapon: true },
            crossbow: { name: '十字弓', kind: 'item', activeUseMode: null, attackWeapon: true },
            rope: { name: '兔脚', kind: 'item', activeUseMode: null, attackWeapon: false },
            'lockpick-tool': { name: '骨制钥匙', kind: 'item', activeUseMode: null, attackWeapon: false },
            'mysterious-stopwatch': { name: '神秘秒表', kind: 'item', activeUseMode: 'extraTurnAfterTurnEnd', attackWeapon: false },
            'hunting-knife': { name: '砍刀', kind: 'item', activeUseMode: null, attackWeapon: true },
            chainsaw: { name: '电锯', kind: 'item', activeUseMode: null, attackWeapon: true },
            dynamite: { name: '炸药', kind: 'item', activeUseMode: null, attackWeapon: true },
            'angel-feather': { name: '天使之羽', kind: 'item', activeUseMode: 'nextNonCombatTraitRollTotalReplacement', attackWeapon: false },
            'omen-book': { name: '书本', kind: 'omen', activeUseMode: 'nextNonCombatTraitReplacement', attackWeapon: false },
            dog: { name: '狗', kind: 'omen', activeUseMode: null, attackWeapon: false },
            mask: { name: '面具', kind: 'omen', activeUseMode: 'moveOthersInRoom', attackWeapon: false },
            skull: { name: '头骨', kind: 'omen', activeUseMode: null, attackWeapon: false },
            'holy-symbol': { name: '圣符', kind: 'omen', activeUseMode: null, attackWeapon: false },
            armor: { name: '盔甲', kind: 'omen', activeUseMode: null, attackWeapon: false },
            idol: { name: '雕像', kind: 'omen', activeUseMode: null, attackWeapon: false },
            ring: { name: '指环', kind: 'omen', activeUseMode: null, attackWeapon: true },
            dagger: { name: '匕首', kind: 'omen', activeUseMode: null, attackWeapon: true },
        });
    });

it('当前 9 张预兆牌均登记真实能力入口而不是只登记翻牌确认', () => {
        const allCardsCore = createPossessionCoverageCore();
        const attackWeaponCardIds = new Set(resolveAttackWeaponCardStatuses(allCardsCore).map((status) => status.card.id));
        const abilityMatrix = Object.fromEntries(BETRAYAL_DISCOVERY_POOLS.possessions.omen.map((card) => {
            const singleCardCore = createStartedFirstScenarioCore(['0', '1', '2']);
            singleCardCore.currentExplorer = {
                ...singleCardCore.currentExplorer,
                inventory: [{ ...card }],
            };
            singleCardCore.currentExplorerInventory = [{ ...card }];
            singleCardCore.turnStartInventoryCardIds = [card.id];
            return [card.id, {
                name: card.name,
                activeUseMode: resolveUseEffect(card)?.mode ?? null,
                attackWeapon: attackWeaponCardIds.has(card.id),
                canUseHolySymbolForDiscovery: canUseHolySymbolForDiscovery(singleCardCore),
                canUseIdolToSkipEvent: canUseIdolToSkipEvent(singleCardCore),
            }];
        }));

        expect(abilityMatrix).toEqual({
            'omen-book': {
                name: '书本',
                activeUseMode: 'nextNonCombatTraitReplacement',
                attackWeapon: false,
                canUseHolySymbolForDiscovery: false,
                canUseIdolToSkipEvent: false,
            },
            dog: {
                name: '狗',
                activeUseMode: null,
                attackWeapon: false,
                canUseHolySymbolForDiscovery: false,
                canUseIdolToSkipEvent: false,
            },
            mask: {
                name: '面具',
                activeUseMode: 'moveOthersInRoom',
                attackWeapon: false,
                canUseHolySymbolForDiscovery: false,
                canUseIdolToSkipEvent: false,
            },
            skull: {
                name: '头骨',
                activeUseMode: null,
                attackWeapon: false,
                canUseHolySymbolForDiscovery: false,
                canUseIdolToSkipEvent: false,
            },
            'holy-symbol': {
                name: '圣符',
                activeUseMode: null,
                attackWeapon: false,
                canUseHolySymbolForDiscovery: true,
                canUseIdolToSkipEvent: false,
            },
            armor: {
                name: '盔甲',
                activeUseMode: null,
                attackWeapon: false,
                canUseHolySymbolForDiscovery: false,
                canUseIdolToSkipEvent: false,
            },
            idol: {
                name: '雕像',
                activeUseMode: null,
                attackWeapon: false,
                canUseHolySymbolForDiscovery: false,
                canUseIdolToSkipEvent: true,
            },
            ring: {
                name: '指环',
                activeUseMode: null,
                attackWeapon: true,
                canUseHolySymbolForDiscovery: false,
                canUseIdolToSkipEvent: false,
            },
            dagger: {
                name: '匕首',
                activeUseMode: null,
                attackWeapon: true,
                canUseHolySymbolForDiscovery: false,
                canUseIdolToSkipEvent: false,
            },
        });
    });

it('当前 22 张物品牌均登记真实能力入口而不是只登记翻牌确认', () => {
        const allCardsCore = createPossessionCoverageCore();
        const attackWeaponCardIds = new Set(resolveAttackWeaponCardStatuses(allCardsCore).map((status) => status.card.id));
        const abilityEntryByCardId = {
            camera: 'nonCombatKnowledgeReplacement',
            'scary-doll': 'recentTraitCheckAllDiceReroll',
            'medical-kit': 'healTraits',
            mirror: 'healTraits',
            'holy-water': 'healTraits',
            'lucky-coin': 'recentTraitCheckBlankDiceRerollMentalDamage',
            'leather-jacket': 'defenseExtraDice',
            'tooth-necklace': 'endTurnDeathsDoorTraitGain',
            flashlight: 'eventTraitExtraDice',
            radio: 'mentalDamageReduction',
            map: 'placeExplorer',
            'strange-amulet': 'otherHauntSetupItem',
            brooch: 'damageReplacementToGeneral',
            gun: 'attackWeapon',
            crossbow: 'attackWeapon',
            rope: 'rabbitFootReroll',
            'lockpick-tool': 'skeletonKeyMove',
            'mysterious-stopwatch': 'extraTurnAfterTurnEnd',
            'hunting-knife': 'attackWeapon',
            chainsaw: 'attackWeapon',
            dynamite: 'dynamiteRoomAttack',
            'angel-feather': 'nextNonCombatTraitRollTotalReplacement',
        };
        const abilityMatrix = Object.fromEntries(BETRAYAL_DISCOVERY_POOLS.possessions.item.map((card) => [
            card.id,
            {
                name: card.name,
                activeUseMode: resolveUseEffect(card)?.mode ?? null,
                attackWeapon: attackWeaponCardIds.has(card.id),
                abilityEntry: abilityEntryByCardId[card.id as keyof typeof abilityEntryByCardId],
            },
        ]));

        expect(Object.keys(abilityEntryByCardId)).toEqual(BETRAYAL_DISCOVERY_POOLS.possessions.item.map((card) => card.id));
        expect(abilityMatrix).toEqual({
            camera: {
                name: '魔法相机',
                activeUseMode: null,
                attackWeapon: false,
                abilityEntry: 'nonCombatKnowledgeReplacement',
            },
            'scary-doll': {
                name: '恐怖玩偶',
                activeUseMode: null,
                attackWeapon: false,
                abilityEntry: 'recentTraitCheckAllDiceReroll',
            },
            'medical-kit': {
                name: '急救包',
                activeUseMode: 'healTraits',
                attackWeapon: false,
                abilityEntry: 'healTraits',
            },
            mirror: {
                name: '镜子',
                activeUseMode: 'healTraits',
                attackWeapon: false,
                abilityEntry: 'healTraits',
            },
            'holy-water': {
                name: '奇怪的药品',
                activeUseMode: 'healTraits',
                attackWeapon: false,
                abilityEntry: 'healTraits',
            },
            'lucky-coin': {
                name: '幸运硬币',
                activeUseMode: null,
                attackWeapon: false,
                abilityEntry: 'recentTraitCheckBlankDiceRerollMentalDamage',
            },
            'leather-jacket': {
                name: '皮夹克',
                activeUseMode: null,
                attackWeapon: false,
                abilityEntry: 'defenseExtraDice',
            },
            'tooth-necklace': {
                name: '牙齿项链',
                activeUseMode: null,
                attackWeapon: false,
                abilityEntry: 'endTurnDeathsDoorTraitGain',
            },
            flashlight: {
                name: '手电筒',
                activeUseMode: null,
                attackWeapon: false,
                abilityEntry: 'eventTraitExtraDice',
            },
            radio: {
                name: '头戴耳机',
                activeUseMode: null,
                attackWeapon: false,
                abilityEntry: 'mentalDamageReduction',
            },
            map: {
                name: '地图',
                activeUseMode: 'placeExplorer',
                attackWeapon: false,
                abilityEntry: 'placeExplorer',
            },
            'strange-amulet': {
                name: '奇异护符',
                activeUseMode: null,
                attackWeapon: false,
                abilityEntry: 'otherHauntSetupItem',
            },
            brooch: {
                name: '胸针',
                activeUseMode: null,
                attackWeapon: false,
                abilityEntry: 'damageReplacementToGeneral',
            },
            gun: {
                name: '枪',
                activeUseMode: null,
                attackWeapon: true,
                abilityEntry: 'attackWeapon',
            },
            crossbow: {
                name: '十字弓',
                activeUseMode: null,
                attackWeapon: true,
                abilityEntry: 'attackWeapon',
            },
            rope: {
                name: '兔脚',
                activeUseMode: null,
                attackWeapon: false,
                abilityEntry: 'rabbitFootReroll',
            },
            'lockpick-tool': {
                name: '骨制钥匙',
                activeUseMode: null,
                attackWeapon: false,
                abilityEntry: 'skeletonKeyMove',
            },
            'mysterious-stopwatch': {
                name: '神秘秒表',
                activeUseMode: 'extraTurnAfterTurnEnd',
                attackWeapon: false,
                abilityEntry: 'extraTurnAfterTurnEnd',
            },
            'hunting-knife': {
                name: '砍刀',
                activeUseMode: null,
                attackWeapon: true,
                abilityEntry: 'attackWeapon',
            },
            chainsaw: {
                name: '电锯',
                activeUseMode: null,
                attackWeapon: true,
                abilityEntry: 'attackWeapon',
            },
            dynamite: {
                name: '炸药',
                activeUseMode: null,
                attackWeapon: true,
                abilityEntry: 'dynamiteRoomAttack',
            },
            'angel-feather': {
                name: '天使之羽',
                activeUseMode: 'nextNonCombatTraitRollTotalReplacement',
                attackWeapon: false,
                abilityEntry: 'nextNonCombatTraitRollTotalReplacement',
            },
        });
    });

it('当前运行持有牌均登记灰尘交叉规则分类', () => {
        const expectedDustCrossingsByCardId = {
            camera: ['nonCombatKnowledgeReplacement', 'dustDeathBurial'],
            'scary-doll': ['recentTraitCheckAllDiceReroll', 'dustDeathBurial'],
            'medical-kit': ['turnStartActiveUseLimit', 'healTraits', 'dustDeathBurial'],
            mirror: ['turnStartActiveUseLimit', 'healTraits', 'dustDeathBurial'],
            'holy-water': ['turnStartActiveUseLimit', 'healTraits', 'dustDeathBurial'],
            'lucky-coin': ['recentTraitCheckBlankDiceRerollMentalDamage', 'dustDeathBurial'],
            'leather-jacket': ['defenseExtraDice', 'dustDeathBurial'],
            'tooth-necklace': ['endTurnDeathsDoorTraitGain', 'dustDeathBurial'],
            flashlight: ['eventTraitExtraDice', 'dustDeathBurial'],
            radio: ['mentalDamageReduction', 'dustDeathBurial'],
            map: ['turnStartActiveUseLimit', 'placeExplorer', 'dustDeathBurial'],
            'strange-amulet': ['otherHauntSetupItem', 'dustDeathBurial'],
            brooch: ['damageReplacementToGeneral', 'dustDeathBurial'],
            gun: ['attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            crossbow: ['attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            rope: ['rabbitFootReroll', 'dustDeathBurial'],
            'lockpick-tool': ['skeletonKeyMove', 'dustDeathBurial'],
            'mysterious-stopwatch': ['turnStartActiveUseLimit', 'extraTurnAfterTurnEnd', 'dustDeathBurial'],
            'hunting-knife': ['attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            chainsaw: ['attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            dynamite: ['dynamiteRoomAttack', 'dustDeathBurial'],
            'angel-feather': ['turnStartActiveUseLimit', 'nextNonCombatTraitRollTotalReplacement', 'dustDeathBurial'],
            'omen-book': ['passiveKnowledgeBonus', 'turnStartActiveUseLimit', 'bookNonCombatReplacement', 'dustDeathBurial'],
            dog: ['passiveSpeedBonus', 'dogTrade', 'tradeAfterUseLimit', 'dustDeathBurial'],
            mask: ['passiveSpeedBonus', 'turnStartActiveUseLimit', 'moveOthersInRoom', 'dustDeathBurial'],
            skull: ['passiveKnowledgeBonus', 'deathPrevention', 'rabbitFootDeathWindow', 'dustDeathBurial'],
            'holy-symbol': ['passiveSanityBonus', 'holySymbolDiscoveryReplacement', 'dustDeathBurial'],
            armor: ['physicalDamageReduction', 'dustDeathBurial'],
            idol: ['passiveMightBonus', 'idolEventSkip', 'dustDeathBurial'],
            ring: ['passiveSanityBonus', 'attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            dagger: ['attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
        };
        const runtimeCards = collectRuntimePossessionCards();

        expect(Object.keys(expectedDustCrossingsByCardId)).toEqual(runtimeCards.map((card) => card.id));
        expect(expectedDustCrossingsByCardId).toEqual({
            camera: ['nonCombatKnowledgeReplacement', 'dustDeathBurial'],
            'scary-doll': ['recentTraitCheckAllDiceReroll', 'dustDeathBurial'],
            'medical-kit': ['turnStartActiveUseLimit', 'healTraits', 'dustDeathBurial'],
            mirror: ['turnStartActiveUseLimit', 'healTraits', 'dustDeathBurial'],
            'holy-water': ['turnStartActiveUseLimit', 'healTraits', 'dustDeathBurial'],
            'lucky-coin': ['recentTraitCheckBlankDiceRerollMentalDamage', 'dustDeathBurial'],
            'leather-jacket': ['defenseExtraDice', 'dustDeathBurial'],
            'tooth-necklace': ['endTurnDeathsDoorTraitGain', 'dustDeathBurial'],
            flashlight: ['eventTraitExtraDice', 'dustDeathBurial'],
            radio: ['mentalDamageReduction', 'dustDeathBurial'],
            map: ['turnStartActiveUseLimit', 'placeExplorer', 'dustDeathBurial'],
            'strange-amulet': ['otherHauntSetupItem', 'dustDeathBurial'],
            brooch: ['damageReplacementToGeneral', 'dustDeathBurial'],
            gun: ['attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            crossbow: ['attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            rope: ['rabbitFootReroll', 'dustDeathBurial'],
            'lockpick-tool': ['skeletonKeyMove', 'dustDeathBurial'],
            'mysterious-stopwatch': ['turnStartActiveUseLimit', 'extraTurnAfterTurnEnd', 'dustDeathBurial'],
            'hunting-knife': ['attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            chainsaw: ['attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            dynamite: ['dynamiteRoomAttack', 'dustDeathBurial'],
            'angel-feather': ['turnStartActiveUseLimit', 'nextNonCombatTraitRollTotalReplacement', 'dustDeathBurial'],
            'omen-book': ['passiveKnowledgeBonus', 'turnStartActiveUseLimit', 'bookNonCombatReplacement', 'dustDeathBurial'],
            dog: ['passiveSpeedBonus', 'dogTrade', 'tradeAfterUseLimit', 'dustDeathBurial'],
            mask: ['passiveSpeedBonus', 'turnStartActiveUseLimit', 'moveOthersInRoom', 'dustDeathBurial'],
            skull: ['passiveKnowledgeBonus', 'deathPrevention', 'rabbitFootDeathWindow', 'dustDeathBurial'],
            'holy-symbol': ['passiveSanityBonus', 'holySymbolDiscoveryReplacement', 'dustDeathBurial'],
            armor: ['physicalDamageReduction', 'dustDeathBurial'],
            idol: ['passiveMightBonus', 'idolEventSkip', 'dustDeathBurial'],
            ring: ['passiveSanityBonus', 'attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
            dagger: ['attackWeapon', 'tradeAfterUseLimit', 'dustDeathBurial'],
        });
    });

it('当前剧本和当前卡牌范围没有登记特殊搜尸用途，搜尸只走通用尸体规则', () => {
        const runtimeCardUseModes = Object.fromEntries(collectRuntimePossessionCards().map((card) => [
            card.name,
            resolveUseEffect(card)?.mode ?? null,
        ]));
        const eventEffectModesByName = Object.fromEntries(BETRAYAL_DISCOVERY_POOLS.events.map((event) => [
            event.name,
            collectEventTemplateEffectModes(event),
        ]));
        const roomEffectIds = Object.values(BETRAYAL_DISCOVERY_POOLS.roomDiscoveryByFloor)
            .flat()
            .flatMap((room) => [
                room.discoveryEffect ?? null,
                room.endTurnEffect ?? null,
                room.enterEffect ?? null,
            ])
            .filter((effect): effect is NonNullable<typeof effect> => Boolean(effect))
            .sort();
        const specialCorpseText = JSON.stringify({
            runtimeCardUseModes,
            eventEffectModesByName,
            roomEffectIds,
        });

        expect(specialCorpseText).not.toMatch(/corpse|loot|尸体|搜尸|搜刮/i);
        expect(runtimeCardUseModes).toMatchObject({
            急救包: 'healTraits',
            奇怪的药品: 'healTraits',
            地图: 'placeExplorer',
            书本: 'nextNonCombatTraitReplacement',
            面具: 'moveOthersInRoom',
        });
        expect(roomEffectIds).toEqual([
            'drawUntilWeapon',
            'gainKnowledge1',
            'gainKnowledge1',
            'gainMight1',
            'gainSanity1',
            'gainSpeed1',
            'moveToBasementLanding',
            'mysticElevator',
            'physicalDamage1',
            'placeObstacleToken',
            'speedCheckFallToBasement',
        ]);

        const corpseCore = createDustTradeAndCorpseLootReadyCore();
        const corpseTargets = resolveCorpseLootTargets(corpseCore);
        const deathSummary = resolveBetrayalDeathStateSummary(corpseCore);

        expect(corpseTargets.map((corpse) => corpse.playerId)).toEqual(['1']);
        expect(corpseTargets[0]?.inventory.map((card) => card.id)).toEqual(['corpse-map', 'corpse-skull']);
        expect(deathSummary.ruleNotes).toContain('死亡后立牌应倒在所在房间，持有物保留并可被同房间存活探索者搜刮。');
        expect(deathSummary.ruleNotes).not.toContain('当前剧本或卡牌提供特殊搜尸用途。');
    });
});
