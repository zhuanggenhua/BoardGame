import { describe, expect, it } from 'vitest';
import { resolveBetrayalMonsterStatuses } from '../monsterReadModel';
import {
    acknowledgePendingCardResolutions,
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createFirstScenarioHauntCore,
    createJackSpiritMovementRollReadyCore,
    createStartedFirstScenarioCore,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    BETRAYAL_DISCOVERY_POOLS,
    findTestExplorer,
    activateTestExplorer,
    setNextDiscoverySymbolRoomsForAllFloors,
    setTestTraitTrack,
    setHighCapacityPhysicalDamageTracks,
    traitTrackPosition,
    traitTrackPositionTotal,
    repeatTraitsForPendingDamage,
    createMagicCameraHauntCore,
    createHelpingHandsHauntCore,
    createHelpingHandsExplorerAttackCore,
    startHelpingHandsMonsterTurn,
} from './helpers/firstScenarioRuntimeHarness';
import {
    resolveHelpingHandsPendingAttackReward,
    resolveHelpingHandsTrollHandAttackOptions,
} from '../hauntAttackRewardReadModel';
import {
    resolveBetrayalMonsterActionPanel,
    resolveBetrayalMonsterActionSet,
    resolveBetrayalMonsterActionSets,
    resolveBetrayalMonsterMoveCost,
    resolveBetrayalMonsterMoveTargetRooms,
    resolveBetrayalMonsterMovementGroups,
    resolveBetrayalMonsterMovementRollGroupPreview,
    resolveBetrayalMonsterTurnRuntimeState,
    resolveBetrayalMonsterTurnStartResolutionPreview,
    resolveBetrayalMonsterTurnStartStatus,
    resolveBetrayalNormalMonsterAttackTargets,
} from '../monsterActionReadModel';

describe('Betrayal first scenario runtime - monster actions and camera haunt', () => {
it('大宅饿了力量攻击获胜后生成伤害或偷牌选择且不立即扣血', () => {
        let core = createHelpingHandsExplorerAttackCore();
        const defenderPhysicalBefore = traitTrackPositionTotal(core, '1', ['might', 'speed']);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );

        expect(resolveHelpingHandsPendingAttackReward(core)).toMatchObject({
            attackerPlayerId: '0',
            defenderPlayerId: '1',
            damageToDefender: 4,
            damageKind: 'physical',
            attackerRoll: 4,
            defenderRoll: 0,
        });
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore);
        expect(core.recentRoll?.latestLabel).toBe('可偷牌或造成 4 点伤害');

        const blockedEndTurn = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        );
        expect(blockedEndTurn.valid).toBe(false);
        expect(blockedEndTurn.error).toContain('请先选择造成伤害或偷取物品/预兆');
    });

it('大宅饿了选择偷取物品或预兆后不造成伤害', () => {
        let core = createHelpingHandsExplorerAttackCore();
        const defenderPhysicalBefore = traitTrackPositionTotal(core, '1', ['might', 'speed']);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD,
            '0',
            { choice: 'steal', cardId: 'first-aid-kit' },
        );

        expect(resolveHelpingHandsPendingAttackReward(core)).toBeNull();
        expect(findTestExplorer(core, '0').inventory.some((card) => card.id === 'first-aid-kit')).toBe(true);
        expect(findTestExplorer(core, '1').inventory.some((card) => card.id === 'first-aid-kit')).toBe(false);
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore);
        expect(core.receivedCardIdsThisTurnByPlayerId['0']).toContain('first-aid-kit');
    });

it('大宅饿了选择造成伤害后由防守者分配才扣属性', () => {
        let core = createHelpingHandsExplorerAttackCore();
        const defenderPhysicalBefore = traitTrackPositionTotal(core, '1', ['might', 'speed']);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_HELPING_HANDS_ATTACK_REWARD,
            '0',
            { choice: 'damage' },
        );

        expect(resolveHelpingHandsPendingAttackReward(core)).toBeNull();
        expect(core.pendingDamageAllocation).toMatchObject({
            playerId: '1',
            sourceTitle: '援手攻击',
            damageKind: 'physical',
            amount: 4,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore);

        const blockedEndTurn = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        );
        expect(blockedEndTurn).toMatchObject({ valid: false, error: '请先分配当前伤害。' });

        const wrongPlayerAllocation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '0',
                { traits: ['might', 'might', 'speed', 'speed'] },
            ),
        );
        expect(wrongPlayerAllocation).toMatchObject({ valid: false, error: '必须由受伤玩家分配伤害。' });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'might', 'speed', 'speed'] },
        );

        expect(core.pendingDamageAllocation).toBeNull();
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore - 4);
        expect(findTestExplorer(core, '1').inventory.some((card) => card.id === 'first-aid-kit')).toBe(true);
    });

it('大宅饿了非力量攻击获胜不能偷物品或预兆', () => {
        let core = createHelpingHandsExplorerAttackCore();
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'ring', name: '指环', kind: 'omen' },
        ];
        core.currentExplorerInventory = core.currentExplorer.inventory.map((card) => ({ ...card }));
        core.turnStartInventoryCardIds = core.currentExplorer.inventory.map((card) => card.id);
        const defenderPhysicalBefore = traitTrackPositionTotal(core, '1', ['might', 'speed']);
        const defenderMentalBefore = traitTrackPositionTotal(core, '1', ['knowledge', 'sanity']);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '0',
            { target: 'hero', targetPlayerId: '1', weaponCardId: 'ring' },
            100,
            createBetrayalScriptedRandom(3, 3, 1, 1),
        );

        expect(resolveHelpingHandsPendingAttackReward(core)).toBeNull();
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore);
        expect(traitTrackPositionTotal(core, '1', ['knowledge', 'sanity'])).toBe(defenderMentalBefore - 4);
        expect(findTestExplorer(core, '1').inventory.some((card) => card.id === 'first-aid-kit')).toBe(true);
        expect(core.usedCardIdsThisTurn).toContain('ring');
    });

it('大宅饿了巨魔手同房提供力量8合击并消耗两个巨魔手', () => {
        let core = createHelpingHandsHauntCore();
        core = startHelpingHandsMonsterTurn(core);
        const helpingHands = core.scenarioRuntime.helpingHands;
        expect(helpingHands).toBeDefined();
        const sharedRoomId = 'entrance-hall';
        core.monsters = core.monsters.map((monster) => (
            helpingHands?.trollHandIds.includes(monster.id)
                ? { ...monster, roomId: sharedRoomId }
                : monster
        ));
        const target = findTestExplorer(core, '1');
        target.roomId = sharedRoomId;
        setTestTraitTrack(core, '1', 'might', [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], 10, 10);
        setTestTraitTrack(core, '1', 'speed', [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], 10, 10);

        const combinedOption = resolveHelpingHandsTrollHandAttackOptions(core).find((option) => option.combined);
        expect(combinedOption).toMatchObject({
            label: '巨魔手合击',
            trollHandIds: helpingHands?.trollHandIds,
            roomId: sharedRoomId,
            might: 8,
            targetPlayerIds: expect.arrayContaining(['1']),
        });
        const defenderPhysicalBefore = traitTrackPositionTotal(core, '1', ['might', 'speed']);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK,
            '0',
            { combined: true, targetPlayerId: '1' },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 2, 2, 2, 2, 1, 1),
        );

        expect(core.scenarioRuntime.helpingHands?.trollHandAttackUsedIdsThisTurn.sort()).toEqual(
            [...(helpingHands?.trollHandIds ?? [])].sort(),
        );
        expect(core.pendingDamageAllocation).toMatchObject({
            playerId: '1',
            sourceTitle: '巨魔手攻击',
            damageKind: 'physical',
            amount: 8,
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore);
        expect(resolveHelpingHandsTrollHandAttackOptions(core)).toEqual([]);

        const wrongPlayerAllocation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
                '0',
                { traits: ['might', 'might', 'might', 'might', 'speed', 'speed', 'speed', 'speed'] },
            ),
        );
        expect(wrongPlayerAllocation).toMatchObject({ valid: false, error: '必须由受伤玩家分配伤害。' });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            '1',
            { traits: ['might', 'might', 'might', 'might', 'speed', 'speed', 'speed', 'speed'] },
        );

        expect(core.pendingDamageAllocation).toBeNull();
        expect(traitTrackPositionTotal(core, '1', ['might', 'speed'])).toBe(defenderPhysicalBefore - 8);
        const spentAttack = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.HELPING_HANDS_TROLL_HAND_ATTACK, '0', {
                monsterId: helpingHands?.trollHandIds[0],
                targetPlayerId: '1',
            }),
        );
        expect(spentAttack.valid).toBe(false);
        expect(spentAttack.error).toContain('必须选择一个可行动的巨魔手');
    });

it('说“茄子”！作祟检定成功会进入魔法相机剧本并按相机持有者决定叛徒', () => {
        const core = createMagicCameraHauntCore('1');

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.hauntCardNumber).toBe(33);
        expect(core.scenarioRuntime.traitorPlayerId).toBe('1');
        expect(core.scenarioRuntime.hauntTraitorResolution).toMatchObject({
            policy: 'magic-camera-owner',
            traitorPlayerId: '1',
            teamModel: 'one-traitor',
            reasonLabel: '魔法相机持有者；没有持有者时为作祟揭秘者',
            candidatePlayerIds: ['1'],
            excludedPlayerIds: [],
            representativeOnly: true,
        });
        expect(core.scenarioRuntime.hauntFirstPlayerResolution).toMatchObject({
            policy: 'left-of-traitor',
            anchorPlayerId: '1',
            nextPlayerId: '2',
            reasonLabel: '叛徒左侧玩家先行动',
            representativeOnly: true,
        });
        expect(core.currentPlayer).toBe('2');
        expect(core.scenarioRuntime.magicCamera?.cameraHolderPlayerId).toBe('1');
        expect(core.scenarioRuntime.magicCamera?.heroEssencePlayerIds.sort()).toEqual(['0', '2']);
        expect(core.scenarioRuntime.magicCamera?.phantomPhotographerIds).toHaveLength(3);
        expect(core.monsters.filter((monster) => monster.name === '幻影摄影师')).toHaveLength(3);
        expect(findTestExplorer(core, '1').inventory.some((card) => card.name === '魔法相机')).toBe(true);

        const fallbackCore = createMagicCameraHauntCore(null);
        expect(fallbackCore.scenarioRuntime.traitorPlayerId).toBe('0');
        expect(fallbackCore.scenarioRuntime.hauntTraitorResolution).toMatchObject({
            policy: 'magic-camera-owner',
            traitorPlayerId: '0',
            teamModel: 'one-traitor',
            candidatePlayerIds: ['0'],
        });
        expect(fallbackCore.scenarioRuntime.hauntFirstPlayerResolution).toMatchObject({
            policy: 'left-of-traitor',
            anchorPlayerId: '0',
            nextPlayerId: '1',
        });
        expect(fallbackCore.currentPlayer).toBe('1');
        expect(fallbackCore.scenarioRuntime.magicCamera?.cameraHolderPlayerId).toBe('0');
        expect(findTestExplorer(fallbackCore, '0').inventory.some((card) => card.name === '魔法相机')).toBe(true);
    });

it('大宅饿了跳过作祟检定后会把属性奖励纳入翻牌确认队列', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '大宅饿了')!];
        core.currentExplorer.traits.knowledge = 4;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });

        expect(core.latestDiscovery?.title).toBe('大宅饿了');
        expect(core.pendingEventChoice?.sourceTitle).toBe('大宅饿了');
        expect(core.turnEndedByDiscovery).toBe(false);
        const knowledgePositionBeforeSkippingHaunt = traitTrackPosition(core, '0', 'knowledge');

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: false, trait: 'knowledge' },
        );

        expect(core.latestDiscovery?.summary).toBe('跳过作祟检定');
        expect(core.latestDiscovery?.detail).toContain('知识 +1');
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => ({
            kind: step.kind,
            text: step.text,
        }))).toEqual([
            { kind: 'event-effect', text: '事件效果：知识 +1' },
        ]);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '大宅饿了',
            stepKind: 'event-effect',
            text: '事件效果：知识 +1',
            index: 1,
            total: 1,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        core = acknowledgePendingCardResolutions(core);
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(traitTrackPosition(core, '0', 'knowledge')).toBe(knowledgePositionBeforeSkippingHaunt + 1);
        expect(core.turnEndedByDiscovery).toBe(true);
    });

it('说“茄子”！跳过作祟检定仍按事件失败分支抽物品', () => {
        let core = createStartedFirstScenarioCore();
        core.drawOrder = ['event'];
        setNextDiscoverySymbolRoomsForAllFloors(core, 'event');
        core.eventOrder = [BETRAYAL_DISCOVERY_POOLS.events.find((event) => event.name === '说“茄子”！')!];
        core.possessionOrderByKind.item = [{ id: 'camera', name: '魔法相机', kind: 'item' }];
        core.currentExplorer.inventory = [
            ...core.currentExplorer.inventory,
            { id: 'omen-book', name: '书本', kind: 'omen' },
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'mask', name: '面具', kind: 'omen' },
        ];
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', { roomId: 'hallway' });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, '0', { roomId: 'ground-north' });
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_EVENT_CHOICE,
            '0',
            { accept: false },
            100,
            createBetrayalScriptedRandom(1, 1),
        );

        expect(core.phase).toBe('preHaunt');
        expect(core.latestDiscovery?.detail).toContain('抽取一张物品卡');
        expect(core.latestDiscovery?.resolutionSteps?.map((step) => ({
            kind: step.kind,
            text: step.text,
        }))).toEqual([
            { kind: 'event-effect', text: '事件效果：抽取一张物品卡' },
        ]);
        expect(core.pendingCardResolutionQueue).toHaveLength(1);
        expect(core.pendingCardResolutionQueue[0]).toMatchObject({
            deckKind: 'event',
            cardName: '说“茄子”！',
            stepKind: 'event-effect',
            text: '事件效果：抽取一张物品卡',
            index: 1,
            total: 1,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.END_TURN, '0', {}),
        )).toMatchObject({
            valid: false,
            error: '请先确认当前翻牌结算。',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_CARD_RESOLUTION, '0', {
            resolutionId: core.pendingCardResolutionQueue[0]!.id,
        });
        core = acknowledgePendingCardResolutions(core);
        expect(core.pendingCardResolutionQueue).toEqual([]);
        expect(core.currentExplorer.inventory.at(-1)?.name).toBe('魔法相机');
        expect(core.turnEndedByDiscovery).toBe(true);
    });

it('魔法相机剧本拍照成功会夺取英雄本质并提升叛徒属性', () => {
        let core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '1');
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '0'
                ? { ...explorer, roomId: 'hallway' }
                : explorer
        ));
        core.currentExplorer.traits.speed = 6;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        const mightBefore = core.currentExplorer.traits.might;

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.TAKE_PHOTO,
            '1',
            { targetPlayerId: '0', trait: 'might' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3),
        );

        expect(core.scenarioRuntime.magicCamera?.heroEssencePlayerIds).not.toContain('0');
        expect(core.scenarioRuntime.magicCamera?.capturedEssencePlayerIds).toContain('0');
        expect(findTestExplorer(core, '1').traits.might).toBe(mightBefore + 1);
        expect(core.recentRoll?.latestLabel).toBe('夺取本质');
    });

it('魔法相机剧本 Smash the Magic Camera 成功且摄影师全灭时英雄胜利', () => {
        let core = createMagicCameraHauntCore('1');
        const magicCamera = core.scenarioRuntime.magicCamera!;
        core.scenarioRuntime.magicCamera = {
            ...magicCamera,
            killedPhantomPhotographerIds: [...magicCamera.phantomPhotographerIds],
        };
        core.monsters = core.monsters.filter((monster) => !magicCamera.phantomPhotographerIds.includes(monster.id));
        core.currentExplorer.roomId = 'hallway';
        core.activeRoomId = 'hallway';
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? { ...explorer, roomId: 'hallway' }
                : explorer
        ));
        core.currentExplorer.traits.sanity = 6;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.SMASH_MAGIC_CAMERA,
            '2',
            {},
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.hauntId).toBe('magic-camera');
        expect(core.endgameResult?.outcome).toBe('survivors');
    });

it('魔法相机剧本区分幻影摄影师被力量击杀和非力量攻击眩晕', () => {
        let killCore = createMagicCameraHauntCore('1');
        const killMonsterId = killCore.scenarioRuntime.magicCamera!.phantomPhotographerIds[0]!;
        killCore.currentExplorer.traits.might = 6;
        killCore.currentExplorerTraits = { ...killCore.currentExplorer.traits };
        killCore.monsters = killCore.monsters.map((monster) => (
            monster.id === killMonsterId
                ? { ...monster, roomId: killCore.currentExplorer.roomId, might: 1 }
                : monster
        ));

        killCore = applyBetrayalCommand(
            killCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'phantom-photographer', targetMonsterId: killMonsterId },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 1),
        );

        expect(killCore.scenarioRuntime.magicCamera?.killedPhantomPhotographerIds).toContain(killMonsterId);
        expect(killCore.monsters.some((monster) => monster.id === killMonsterId)).toBe(false);

        let stunCore = createMagicCameraHauntCore('1');
        const stunMonsterId = stunCore.scenarioRuntime.magicCamera!.phantomPhotographerIds[0]!;
        stunCore.currentExplorer.inventory = [...stunCore.currentExplorer.inventory, { id: 'ring', name: '指环', kind: 'omen' }];
        stunCore.currentExplorerInventory = [...stunCore.currentExplorer.inventory];
        stunCore.turnStartInventoryCardIds = [...stunCore.turnStartInventoryCardIds, 'ring'];
        stunCore.currentExplorer.traits.sanity = 6;
        stunCore.currentExplorerTraits = { ...stunCore.currentExplorer.traits };
        stunCore.monsters = stunCore.monsters.map((monster) => (
            monster.id === stunMonsterId
                ? { ...monster, roomId: stunCore.currentExplorer.roomId, sanity: 1 }
                : monster
        ));

        stunCore = applyBetrayalCommand(
            stunCore,
            BETRAYAL_COMMANDS.HAUNT_ATTACK,
            '2',
            { target: 'phantom-photographer', targetMonsterId: stunMonsterId, weaponCardId: 'ring' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 1),
        );

        expect(stunCore.scenarioRuntime.magicCamera?.stunnedPhantomPhotographerIds).toContain(stunMonsterId);
        expect(stunCore.scenarioRuntime.magicCamera?.killedPhantomPhotographerIds).not.toContain(stunMonsterId);
        expect(stunCore.monsters.some((monster) => monster.id === stunMonsterId)).toBe(true);

        activateTestExplorer(stunCore, '1');
        const stunnedAttack = BetrayalDomain.validate(
            { core: stunCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK, '1', {
                monsterId: stunMonsterId,
                targetPlayerId: '2',
            }),
        );
        expect(stunnedAttack.valid).toBe(false);
        expect(stunnedAttack.error).toContain('已被眩晕');
    });

it('怪物状态读模型区分幻影摄影师眩晕和杀死移除', () => {
        const core = createMagicCameraHauntCore('1');
        const [stunnedMonsterId, killedMonsterId] = core.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(stunnedMonsterId).toBeDefined();
        expect(killedMonsterId).toBeDefined();
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId!],
            killedPhantomPhotographerIds: [killedMonsterId!],
        };
        core.monsters = core.monsters.filter((monster) => monster.id !== killedMonsterId);

        const statuses = resolveBetrayalMonsterStatuses(core);
        const stunnedStatus = statuses.find((status) => status.monsterId === stunnedMonsterId);
        const killedStatus = statuses.find((status) => status.monsterId === killedMonsterId);

        expect(stunnedStatus).toMatchObject({
            name: '幻影摄影师',
            status: 'stunned',
            canBeStunned: true,
            stunned: true,
            killed: false,
            removedFromHouse: false,
            slowsHeroMovement: false,
            canHoldPossessions: false,
            canExploreNewRooms: false,
            traits: {
                usesTraitTrack: false,
            },
        });
        expect(killedStatus).toMatchObject({
            name: '幻影摄影师',
            roomId: null,
            status: 'killed',
            canBeStunned: true,
            stunned: false,
            killed: true,
            removedFromHouse: true,
            slowsHeroMovement: false,
            traits: {
                might: 4,
                speed: 1,
                sanity: 6,
                knowledge: 2,
                usesTraitTrack: false,
            },
        });
        expect(statuses.filter((status) => status.monsterId === killedMonsterId)).toHaveLength(1);
    });

it('怪物回合开始读模型会让已击晕怪物翻正并跳过本次回合', () => {
        const core = createMagicCameraHauntCore('1');
        const [stunnedMonsterId, killedMonsterId, activeMonsterId] = core.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(stunnedMonsterId).toBeDefined();
        expect(killedMonsterId).toBeDefined();
        expect(activeMonsterId).toBeDefined();
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId!],
            killedPhantomPhotographerIds: [killedMonsterId!],
        };
        core.monsters = core.monsters.filter((monster) => monster.id !== killedMonsterId);

        expect(resolveBetrayalMonsterTurnStartStatus(core, stunnedMonsterId!)).toMatchObject({
            monsterId: stunnedMonsterId,
            name: '幻影摄影师',
            status: 'stunned',
            nextStatus: 'active',
            canStartTurn: false,
            mustFlipStunnedSideUp: true,
            mustSkipTurn: true,
            canRollMovement: false,
            canAttack: false,
        });
        expect(resolveBetrayalMonsterTurnStartStatus(core, killedMonsterId!)).toMatchObject({
            status: 'killed',
            nextStatus: 'killed',
            canStartTurn: false,
            mustSkipTurn: true,
            canRollMovement: false,
            canAttack: false,
        });
        expect(resolveBetrayalMonsterTurnStartStatus(core, activeMonsterId!)).toMatchObject({
            status: 'active',
            nextStatus: 'active',
            canStartTurn: true,
            mustFlipStunnedSideUp: false,
            mustSkipTurn: false,
            canRollMovement: true,
            canAttack: true,
            reason: null,
        });
    });

it('怪物回合开始结算预览会列出翻正跳过和移动骰合同', () => {
        const core = createMagicCameraHauntCore('1');
        const [stunnedMonsterId, killedMonsterId, activeMonsterId] = core.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(stunnedMonsterId).toBeDefined();
        expect(killedMonsterId).toBeDefined();
        expect(activeMonsterId).toBeDefined();
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId!],
            killedPhantomPhotographerIds: [killedMonsterId!],
        };
        core.monsters = core.monsters.filter((monster) => monster.id !== killedMonsterId);

        expect(resolveBetrayalMonsterTurnStartResolutionPreview(core, stunnedMonsterId!)).toMatchObject({
            active: true,
            canResolve: true,
            resolutionStatus: 'ready',
            monsterId: stunnedMonsterId,
            name: '幻影摄影师',
            status: 'stunned',
            nextStatus: 'active',
            willFlipStunnedSideUp: true,
            willRemoveStunnedMarker: true,
            willSkipTurn: true,
            willStartTurn: false,
            willRollMovement: false,
            willOpenAttackWindow: false,
            movementGroupId: null,
            movementDiceCount: null,
            minimumMoveAllowance: null,
            contractGaps: ['ui-token-flip'],
            previewOnly: true,
        });
        expect(resolveBetrayalMonsterTurnStartResolutionPreview(core, activeMonsterId!)).toMatchObject({
            active: true,
            canResolve: true,
            resolutionStatus: 'ready',
            monsterId: activeMonsterId,
            status: 'active',
            nextStatus: 'active',
            willFlipStunnedSideUp: false,
            willRemoveStunnedMarker: false,
            willSkipTurn: false,
            willStartTurn: true,
            willRollMovement: true,
            willOpenAttackWindow: true,
            movementGroupId: '幻影摄影师:1',
            movementDiceCount: 1,
            minimumMoveAllowance: 1,
            contractGaps: [],
            previewOnly: true,
            reason: null,
        });
        expect(resolveBetrayalMonsterTurnStartResolutionPreview(core, killedMonsterId!)).toMatchObject({
            active: true,
            canResolve: true,
            resolutionStatus: 'ready',
            status: 'killed',
            nextStatus: 'killed',
            willSkipTurn: true,
            willStartTurn: false,
            willRollMovement: false,
            willOpenAttackWindow: false,
            contractGaps: [],
        });
        expect(resolveBetrayalMonsterTurnStartResolutionPreview(core, 'missing-monster')).toMatchObject({
            active: false,
            canResolve: false,
            resolutionStatus: 'missing-monster',
            status: null,
            nextStatus: null,
            contractGaps: [],
            reason: '当前宅邸中找不到该怪物。',
        });
    });

it('怪物回合开始正式命令会翻正击晕怪物并记录本次跳过', () => {
        let core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '1');
        const stunnedMonsterId = core.scenarioRuntime.magicCamera!.phantomPhotographerIds[0]!;
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId],
        };

        const validation = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START, '1', { monsterId: stunnedMonsterId }),
        );
        expect(validation.valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START,
            '1',
            { monsterId: stunnedMonsterId },
        );

        expect(core.scenarioRuntime.magicCamera?.stunnedPhantomPhotographerIds).not.toContain(stunnedMonsterId);
        expect(resolveBetrayalMonsterTurnStartStatus(core, stunnedMonsterId)).toMatchObject({
            status: 'active',
            canRollMovement: false,
            canAttack: false,
            reason: '该怪物本回合已跳过，不能再次移动或攻击。',
        });
        expect(resolveBetrayalMonsterTurnRuntimeState(core)).toMatchObject({
            resolvedStartMonsterIds: [stunnedMonsterId],
            skippedMonsterIdsThisTurn: [stunnedMonsterId],
        });
        expect(resolveBetrayalMonsterMovementGroups(core).flatMap((group) => group.monsterIds))
            .not.toContain(stunnedMonsterId);
        expect(resolveBetrayalMonsterMoveTargetRooms(core, stunnedMonsterId)).toEqual([]);
        expect(resolveBetrayalMonsterActionSet(core, stunnedMonsterId)).toMatchObject({
            canMove: false,
            canAttack: false,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START, '1', { monsterId: stunnedMonsterId }),
        )).toMatchObject({
            valid: false,
            error: '该怪物本回合开始步骤已处理。',
        });
        expect(core.activityLog[0]?.text).toContain('翻回正面');
    });

it('怪物移动骰组正式命令会写入同类型怪物共享移动额度', () => {
        let core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '1');
        const groupId = '幻影摄影师:1';
        const activeMonsterIds = resolveBetrayalMonsterMovementGroups(core)
            .find((group) => group.groupId === groupId)?.monsterIds ?? [];
        expect(activeMonsterIds.length).toBeGreaterThan(1);
        expect(resolveBetrayalMonsterMovementRollGroupPreview(core, groupId)).toMatchObject({
            canRoll: true,
            contractGaps: ['path-preview-ui'],
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            '1',
            { groupId },
            100,
            createBetrayalScriptedRandom(3),
        );

        const monsterTurn = resolveBetrayalMonsterTurnRuntimeState(core);
        expect(monsterTurn.movementRollsByGroupId[groupId]).toMatchObject({
            groupId,
            monsterName: '幻影摄影师',
            monsterIds: activeMonsterIds,
            dice: [2],
            total: 2,
            moveAllowance: 2,
        });
        expect(Object.fromEntries(
            activeMonsterIds.map((monsterId) => [monsterId, monsterTurn.moveRemainingById[monsterId]]),
        )).toEqual(Object.fromEntries(activeMonsterIds.map((monsterId) => [monsterId, 2])));
        expect(core.recentRoll).toMatchObject({
            kind: 'monsterMoveRoll',
            playerId: '1',
            sourceTitle: '幻影摄影师移动',
            latestLabel: '每只可移动 2 间',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP, '1', { groupId }),
        )).toMatchObject({
            valid: false,
            error: '该怪物移动骰组本回合已掷骰。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        expect(resolveBetrayalMonsterTurnRuntimeState(core)).toMatchObject({
            resolvedStartMonsterIds: [],
            skippedMonsterIdsThisTurn: [],
            movementRollsByGroupId: {},
            moveRemainingById: {},
        });
    });

it('同类型普通怪物共用一次移动骰但逐只独立消耗移动额度', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        activateTestExplorer(core, traitorId);
        const monsterIds = ['test-normal-monster-a', 'test-normal-monster-b'];
        const roomId = 'entrance-hall';
        core.currentExplorer.roomId = roomId;
        core.otherExplorers = core.otherExplorers.map((explorer) => ({ ...explorer, roomId }));
        core.activeRoomId = roomId;
        core.currentExplorerRoomId = roomId;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = monsterIds.map((id) => ({
            id,
            name: '测试怪物',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId,
            might: 4,
            speed: 1,
            sanity: 4,
            knowledge: 4,
            damage: 1,
        }));
        const groupId = '测试怪物:1';
        expect(resolveBetrayalMonsterMovementGroups(core)).toEqual([
            expect.objectContaining({
                groupId,
                monsterIds,
                diceCount: 1,
                rollOnceForGroup: true,
                minimumMoveAllowance: 1,
            }),
        ]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            traitorId,
            { groupId },
            100,
            createBetrayalScriptedRandom(3),
        );

        let monsterTurn = resolveBetrayalMonsterTurnRuntimeState(core);
        expect(monsterTurn.movementRollsByGroupId[groupId]).toMatchObject({
            monsterIds,
            dice: [2],
            moveAllowance: 2,
        });
        expect(monsterTurn.moveRemainingById).toMatchObject({
            [monsterIds[0]!]: 2,
            [monsterIds[1]!]: 2,
        });
        const targetRoom = resolveBetrayalMonsterMoveTargetRooms(core, monsterIds[0]!)[0];
        expect(targetRoom).toBeDefined();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM,
            traitorId,
            { monsterId: monsterIds[0]!, roomId: targetRoom!.id },
        );
        monsterTurn = resolveBetrayalMonsterTurnRuntimeState(core);
        expect(core.monsters.find((monster) => monster.id === monsterIds[0])?.roomId).toBe(targetRoom!.id);
        expect(core.monsters.find((monster) => monster.id === monsterIds[1])?.roomId).toBe(roomId);
        expect(monsterTurn.moveRemainingById).toMatchObject({
            [monsterIds[0]!]: 0,
            [monsterIds[1]!]: 2,
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, traitorId, {
                monsterId: monsterIds[1]!,
                roomId: targetRoom!.id,
            }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM,
            traitorId,
            { monsterId: monsterIds[1]!, roomId: targetRoom!.id },
        );
        monsterTurn = resolveBetrayalMonsterTurnRuntimeState(core);
        expect(core.monsters.find((monster) => monster.id === monsterIds[1])?.roomId).toBe(targetRoom!.id);
        expect(monsterTurn.moveRemainingById).toMatchObject({
            [monsterIds[0]!]: 0,
            [monsterIds[1]!]: 0,
        });
    });

it('多类型普通怪物移动骰组会分开掷骰并在第一组完成后继续开放第二组', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        activateTestExplorer(core, traitorId);
        const roomId = 'entrance-hall';
        core.currentExplorer.roomId = roomId;
        core.otherExplorers = core.otherExplorers.map((explorer) => ({ ...explorer, roomId }));
        core.activeRoomId = roomId;
        core.currentExplorerRoomId = roomId;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.currentExplorerInventory = [...core.currentExplorer.inventory];
        core.monsters = [
            {
                id: 'test-slow-monster',
                name: '慢速怪物',
                portraitAsset: 'betrayal/monsters/spirit',
                tokenAsset: 'betrayal/tokens/monsters/ghost',
                roomId,
                might: 4,
                speed: 1,
                sanity: 4,
                knowledge: 4,
                damage: 1,
            },
            {
                id: 'test-fast-monster',
                name: '快速怪物',
                portraitAsset: 'betrayal/monsters/spirit',
                tokenAsset: 'betrayal/tokens/monsters/ghost',
                roomId,
                might: 4,
                speed: 2,
                sanity: 4,
                knowledge: 4,
                damage: 1,
            },
        ];
        expect(resolveBetrayalMonsterMovementGroups(core).map((group) => group.groupId)).toEqual([
            '慢速怪物:1',
            '快速怪物:2',
        ]);
        let panel = resolveBetrayalMonsterActionPanel(core);
        expect(panel.slots.find((slot) => slot.id === 'movement-roll:慢速怪物:1')).toMatchObject({
            kind: 'movement-roll',
            enabled: true,
        });
        expect(panel.slots.find((slot) => slot.id === 'movement-roll:快速怪物:2')).toMatchObject({
            kind: 'movement-roll',
            enabled: true,
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            traitorId,
            { groupId: '慢速怪物:1' },
            100,
            createBetrayalScriptedRandom(3),
        );

        let monsterTurn = resolveBetrayalMonsterTurnRuntimeState(core);
        expect(monsterTurn.movementRollsByGroupId['慢速怪物:1']).toMatchObject({
            monsterIds: ['test-slow-monster'],
            moveAllowance: 2,
        });
        expect(monsterTurn.movementRollsByGroupId['快速怪物:2']).toBeUndefined();
        panel = resolveBetrayalMonsterActionPanel(core);
        expect(panel.slots.find((slot) => slot.id === 'movement-roll:慢速怪物:1')).toMatchObject({
            enabled: false,
            reason: '该怪物移动骰组本回合已掷骰。',
        });
        expect(panel.slots.find((slot) => slot.id === 'movement-roll:快速怪物:2')).toMatchObject({
            enabled: true,
            reason: null,
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            traitorId,
            { groupId: '快速怪物:2' },
            100,
            createBetrayalScriptedRandom(3, 3),
        );

        monsterTurn = resolveBetrayalMonsterTurnRuntimeState(core);
        expect(monsterTurn.movementRollsByGroupId['快速怪物:2']).toMatchObject({
            monsterIds: ['test-fast-monster'],
            dice: [2, 2],
            moveAllowance: 4,
        });
        panel = resolveBetrayalMonsterActionPanel(core);
        expect(panel.slots.find((slot) => slot.kind === 'movement-roll' && slot.enabled)).toBeUndefined();
        expect(panel.slots.find((slot) => slot.id === 'move:test-slow-monster')).toMatchObject({
            enabled: true,
            moveRemaining: 2,
        });
        expect(panel.slots.find((slot) => slot.id === 'move:test-fast-monster')).toMatchObject({
            enabled: true,
            moveRemaining: 4,
        });
    });

it('怪物正式移动命令会消耗移动额度并写回目标房间', () => {
        let core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '1');
        const groupId = '幻影摄影师:1';
        const monsterId = core.scenarioRuntime.magicCamera!.phantomPhotographerIds[0]!;
        core.monsters = core.monsters.map((monster) => (
            monster.id === monsterId
                ? { ...monster, roomId: 'hallway' }
                : monster
        ));
        findTestExplorer(core, '0').roomId = 'hallway';
        const targetRoom = resolveBetrayalMonsterMoveTargetRooms(core, monsterId)[0];
        expect(targetRoom).toBeDefined();
        expect(resolveBetrayalMonsterMoveCost(core, monsterId)).toBe(2);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, '1', {
                monsterId,
                roomId: targetRoom!.id,
            }),
        )).toMatchObject({
            valid: false,
            error: '该怪物本回合没有剩余移动额度。',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            '1',
            { groupId },
            100,
            createBetrayalScriptedRandom(3),
        );
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, '1', {
                monsterId,
                roomId: targetRoom!.id,
            }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM,
            '1',
            { monsterId, roomId: targetRoom!.id },
        );

        expect(core.monsters.find((monster) => monster.id === monsterId)?.roomId).toBe(targetRoom!.id);
        expect(resolveBetrayalMonsterTurnRuntimeState(core).moveRemainingById[monsterId]).toBe(0);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, '1', {
                monsterId,
                roomId: 'entrance-hall',
            }),
        )).toMatchObject({
            valid: false,
            error: '该怪物本回合没有剩余移动额度。',
        });
        expect(core.activityLog.some((entry) => entry.text.includes('幻影摄影师') && entry.text.includes('移动到'))).toBe(true);
    });

it('杰克之灵通过通用怪物移动命令移动时会同步专用房间状态', () => {
        let core = createJackSpiritMovementRollReadyCore();
        const movementGroup = resolveBetrayalMonsterMovementGroups(core)
            .find((group) => group.monsterIds.includes('jack-spirit'));
        expect(movementGroup).toBeDefined();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            '2',
            { groupId: movementGroup!.groupId },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        const targetRoom = resolveBetrayalMonsterMoveTargetRooms(core, 'jack-spirit')
            .find((room) => room.id === 'upper-landing');
        expect(targetRoom).toBeDefined();

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM,
            '2',
            { monsterId: 'jack-spirit', roomId: targetRoom!.id },
        );

        expect(core.monsters.find((monster) => monster.id === 'jack-spirit')?.roomId).toBe('upper-landing');
        expect(core.scenarioRuntime.jackSpiritRoomId).toBe('upper-landing');
        expect(core.scenarioRuntime.jackSpiritHasMovedSinceRelease).toBe(true);
        expect(core.activeRoomId).toBe('upper-landing');
        expect(resolveBetrayalMonsterTurnRuntimeState(core).moveRemainingById['jack-spirit']).toBeGreaterThanOrEqual(0);
    });

it('怪物移动分组读模型不会给击晕或已杀死怪物分配移动骰组', () => {
        const core = createMagicCameraHauntCore('1');
        const [stunnedMonsterId, killedMonsterId, activeMonsterId] = core.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(stunnedMonsterId).toBeDefined();
        expect(killedMonsterId).toBeDefined();
        expect(activeMonsterId).toBeDefined();
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId!],
            killedPhantomPhotographerIds: [killedMonsterId!],
        };
        core.monsters = core.monsters.filter((monster) => monster.id !== killedMonsterId);

        const movementGroups = resolveBetrayalMonsterMovementGroups(core);

        expect(movementGroups).toHaveLength(1);
        expect(movementGroups[0]).toMatchObject({
            monsterName: '幻影摄影师',
            monsterIds: [activeMonsterId],
            speed: 1,
            diceCount: 1,
            rollOnceForGroup: true,
            minimumMoveAllowance: 1,
        });
        expect(movementGroups[0]?.monsterIds).not.toContain(stunnedMonsterId);
        expect(movementGroups[0]?.monsterIds).not.toContain(killedMonsterId);
    });

it('怪物移动目标读模型不会让击晕或已杀死怪物移动', () => {
        const core = createMagicCameraHauntCore('1');
        const [stunnedMonsterId, killedMonsterId, activeMonsterId] = core.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(stunnedMonsterId).toBeDefined();
        expect(killedMonsterId).toBeDefined();
        expect(activeMonsterId).toBeDefined();
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId!],
            killedPhantomPhotographerIds: [killedMonsterId!],
        };
        core.monsters = core.monsters.filter((monster) => monster.id !== killedMonsterId);

        expect(resolveBetrayalMonsterMoveTargetRooms(core, stunnedMonsterId!)).toEqual([]);
        expect(resolveBetrayalMonsterMoveTargetRooms(core, killedMonsterId!)).toEqual([]);
        expect(resolveBetrayalMonsterMoveTargetRooms(core, activeMonsterId!)
            .every((room) => room.state === 'discovered')).toBe(true);
    });

it('怪物行动集合读模型不会给击晕或已杀死怪物开放移动和攻击', () => {
        const core = createMagicCameraHauntCore('1');
        const [stunnedMonsterId, killedMonsterId, activeMonsterId] = core.scenarioRuntime.magicCamera!.phantomPhotographerIds;
        expect(stunnedMonsterId).toBeDefined();
        expect(killedMonsterId).toBeDefined();
        expect(activeMonsterId).toBeDefined();
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId!],
            killedPhantomPhotographerIds: [killedMonsterId!],
        };
        core.monsters = core.monsters.filter((monster) => monster.id !== killedMonsterId);

        const actionSets = resolveBetrayalMonsterActionSets(core);
        const stunnedActionSet = actionSets.find((actionSet) => actionSet.monsterId === stunnedMonsterId);
        const killedActionSet = actionSets.find((actionSet) => actionSet.monsterId === killedMonsterId);
        const activeActionSet = actionSets.find((actionSet) => actionSet.monsterId === activeMonsterId);

        expect(stunnedActionSet).toMatchObject({
            status: 'stunned',
            canMove: false,
            moveTargetRoomIds: [],
            canAttack: false,
            usesNormalAttackRules: false,
        });
        expect(killedActionSet).toMatchObject({
            status: 'killed',
            roomId: null,
            canMove: false,
            moveTargetRoomIds: [],
            canAttack: false,
            usesNormalAttackRules: false,
        });
        expect(activeActionSet).toMatchObject({
            status: 'active',
            canAttack: true,
            defaultAttackTrait: 'sanity',
        });
    });

it('怪物动作槽读模型会把击晕翻正跳过和 UI 翻面缺口暴露给界面', () => {
        const core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '1');
        const stunnedMonsterId = core.scenarioRuntime.magicCamera!.phantomPhotographerIds[0]!;
        core.scenarioRuntime.magicCamera = {
            ...core.scenarioRuntime.magicCamera!,
            stunnedPhantomPhotographerIds: [stunnedMonsterId],
        };

        const panel = resolveBetrayalMonsterActionPanel(core);
        const turnStartSlot = panel.slots.find((slot) => slot.id === `turn-start:${stunnedMonsterId}`);
        const moveSlot = panel.slots.find((slot) => slot.id === `move:${stunnedMonsterId}`);
        const attackSlot = panel.slots.find((slot) => slot.id === `attack:${stunnedMonsterId}`);

        expect(panel.active).toBe(true);
        expect(panel.contractGaps).toContain('ui-token-flip');
        expect(turnStartSlot).toMatchObject({
            kind: 'turn-start',
            command: BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START,
            enabled: true,
            contractGaps: ['ui-token-flip'],
        });
        expect(moveSlot).toMatchObject({
            enabled: false,
            targetRoomIds: [],
        });
        expect(attackSlot).toMatchObject({
            enabled: false,
            defaultAttackTrait: 'sanity',
        });
    });

it('普通怪物攻击目标读模型只列出同房存活英雄并可走正式命令', () => {
        const core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const [aliveHeroId, deadHeroId] = core.playerIds.filter((playerId) => playerId !== traitorId);
        expect(aliveHeroId).toBeDefined();
        expect(deadHeroId).toBeDefined();
        const roomId = 'entrance-hall';
        core.monsters = [{
            id: 'test-normal-monster',
            name: '测试怪物',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId,
            might: 4,
            speed: 3,
            sanity: 4,
            knowledge: 4,
            damage: 1,
        }];
        findTestExplorer(core, traitorId).roomId = roomId;
        findTestExplorer(core, aliveHeroId!).roomId = roomId;
        findTestExplorer(core, deadHeroId!).roomId = roomId;
        core.scenarioRuntime.deadExplorerPlayerIds = [deadHeroId!];

        const targets = resolveBetrayalNormalMonsterAttackTargets(core, 'test-normal-monster');

        expect(targets).toMatchObject({
            monsterId: 'test-normal-monster',
            monsterName: '测试怪物',
            roomId,
            defaultAttackTrait: 'might',
            targetPlayerIds: [aliveHeroId],
            usesNormalAttackRules: true,
            canResolveWithExistingCommand: true,
            reason: null,
            contractGaps: [],
        });
        expect(targets?.targetPlayerIds).not.toContain(traitorId);
        expect(targets?.targetPlayerIds).not.toContain(deadHeroId);
        expect(targets?.targetLabels).toEqual([findTestExplorer(core, aliveHeroId!).displayName]);
    });

it('普通怪物正式攻击命令只允许同房存活英雄目标', () => {
        const core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        activateTestExplorer(core, traitorId);
        const [aliveHeroId, deadHeroId] = core.playerIds.filter((playerId) => playerId !== traitorId);
        expect(aliveHeroId).toBeDefined();
        expect(deadHeroId).toBeDefined();
        const monsterId = 'test-normal-monster';
        const roomId = 'entrance-hall';
        core.monsters = [{
            id: monsterId,
            name: '测试怪物',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId,
            might: 4,
            speed: 3,
            sanity: 4,
            knowledge: 4,
            damage: 1,
        }];
        findTestExplorer(core, traitorId).roomId = roomId;
        findTestExplorer(core, aliveHeroId!).roomId = roomId;
        findTestExplorer(core, deadHeroId!).roomId = roomId;
        core.scenarioRuntime.deadExplorerPlayerIds = [deadHeroId!];

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO, traitorId, {
                monsterId,
                targetPlayerId: aliveHeroId,
            }),
        )).toMatchObject({ valid: true });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO, traitorId, {
                monsterId,
                targetPlayerId: traitorId,
            }),
        )).toMatchObject({ valid: false });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO, traitorId, {
                monsterId,
                targetPlayerId: deadHeroId,
            }),
        )).toMatchObject({ valid: false });

        findTestExplorer(core, aliveHeroId!).roomId = 'hallway';
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO, traitorId, {
                monsterId,
                targetPlayerId: aliveHeroId,
            }),
        )).toMatchObject({ valid: false });
    });

it('普通怪物正式攻击会进入攻击骰盘、待分配伤害并关闭该怪物攻击槽', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        activateTestExplorer(core, traitorId);
        const targetHeroId = core.playerIds.find((playerId) => playerId !== traitorId)!;
        const monsterId = 'test-normal-monster';
        const roomId = 'entrance-hall';
        core.monsters = [{
            id: monsterId,
            name: '测试怪物',
            portraitAsset: 'betrayal/monsters/spirit',
            tokenAsset: 'betrayal/tokens/monsters/ghost',
            roomId,
            might: 4,
            speed: 3,
            sanity: 4,
            knowledge: 4,
            damage: 1,
        }];
        findTestExplorer(core, targetHeroId).roomId = roomId;
        setHighCapacityPhysicalDamageTracks(core, targetHeroId);
        const heroPhysicalPositionBefore = traitTrackPositionTotal(core, targetHeroId, ['might', 'speed']);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            traitorId,
            { monsterId, targetPlayerId: targetHeroId },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1),
        );

        expect(core.recentRoll).toMatchObject({
            kind: 'attackRoll',
            sourceTitle: '测试怪物攻击',
            playerId: traitorId,
            attack: {
                target: 'hero',
                defenderPlayerId: targetHeroId,
                damageKind: 'physical',
            },
        });
        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '攻击',
            playerId: targetHeroId,
            damageKind: 'physical',
            allowedTraits: ['might', 'speed'],
            allowSkull: true,
        });
        expect(core.scenarioRuntime.monsterTurn.attackedMonsterIdsThisTurn).toContain(monsterId);
        expect(traitTrackPositionTotal(core, targetHeroId, ['might', 'speed'])).toBe(heroPhysicalPositionBefore);
        expect(resolveBetrayalMonsterActionPanel(core).slots.find((slot) => slot.id === `attack:${monsterId}`)).toMatchObject({
            enabled: false,
            reason: '该怪物本回合已经攻击过。',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION,
            targetHeroId,
            { traits: repeatTraitsForPendingDamage(core, ['might', 'speed']) },
        );
        expect(core.pendingDamageAllocation).toBeNull();
        expect(traitTrackPositionTotal(core, targetHeroId, ['might', 'speed'])).toBeLessThan(heroPhysicalPositionBefore);
    });

it('杰克之灵普通攻击目标读模型复用现有攻击命令并排除叛徒和死亡英雄', () => {
        const core = createJackSpiritMovementRollReadyCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const [aliveHeroId, deadHeroId] = core.playerIds.filter((playerId) => playerId !== traitorId);
        expect(aliveHeroId).toBeDefined();
        expect(deadHeroId).toBeDefined();
        const roomId = core.scenarioRuntime.jackSpiritRoomId!;
        findTestExplorer(core, traitorId).roomId = roomId;
        findTestExplorer(core, aliveHeroId!).roomId = roomId;
        findTestExplorer(core, deadHeroId!).roomId = roomId;
        core.scenarioRuntime.deadExplorerPlayerIds = [deadHeroId!];

        const targets = resolveBetrayalNormalMonsterAttackTargets(core, 'jack-spirit');

        expect(targets).toMatchObject({
            monsterId: 'jack-spirit',
            monsterName: '杰克之灵',
            roomId,
            defaultAttackTrait: 'might',
            targetPlayerIds: [aliveHeroId],
            usesNormalAttackRules: true,
            canResolveWithExistingCommand: true,
            reason: null,
            contractGaps: [],
        });
        expect(targets?.targetPlayerIds).not.toContain(traitorId);
        expect(targets?.targetPlayerIds).not.toContain(deadHeroId);
    });

it('怪物动作槽读模型会先要求掷移动骰，掷完后才开放移动目标', () => {
        let core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '1');
        const groupId = '幻影摄影师:1';
        const monsterId = core.scenarioRuntime.magicCamera!.phantomPhotographerIds[0]!;
        core.monsters = core.monsters.map((monster) => (
            monster.id === monsterId
                ? { ...monster, roomId: 'hallway' }
                : monster
        ));
        findTestExplorer(core, '0').roomId = 'hallway';

        const beforeRoll = resolveBetrayalMonsterActionPanel(core);
        expect(beforeRoll.movementGroupIds).toContain(groupId);
        expect(beforeRoll.slots.find((slot) => slot.id === `movement-roll:${groupId}`)).toMatchObject({
            command: BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            enabled: true,
            contractGaps: ['path-preview-ui'],
        });
        expect(beforeRoll.slots.find((slot) => slot.id === `move:${monsterId}`)).toMatchObject({
            command: BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM,
            enabled: false,
            moveRemaining: 0,
            moveCost: 2,
            reason: '请先为该怪物所属类型掷移动骰，或移动点不足以离开当前房间。',
        });

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            '1',
            { groupId },
            100,
            createBetrayalScriptedRandom(3),
        );

        const afterRoll = resolveBetrayalMonsterActionPanel(core);
        const moveSlot = afterRoll.slots.find((slot) => slot.id === `move:${monsterId}`);
        expect(moveSlot).toMatchObject({
            enabled: true,
            moveRemaining: 2,
            moveCost: 2,
        });
        expect(moveSlot?.targetRoomIds.length).toBeGreaterThan(0);
        expect(afterRoll.contractGaps).toContain('path-preview-ui');
        expect(afterRoll.slots.find((slot) => slot.id === `attack:${monsterId}`)).toMatchObject({
            command: BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK,
            enabled: true,
            defaultAttackTrait: 'sanity',
            contractGaps: ['attack-target-ui'],
        });
    });

it('魔法相机剧本幻影摄影师视线攻击可击倒全部英雄并让叛徒胜利', () => {
        let core = createMagicCameraHauntCore('1');
        activateTestExplorer(core, '1');
        const monsterId = core.scenarioRuntime.magicCamera!.phantomPhotographerIds[0]!;
        const hero = findTestExplorer(core, '2');
        hero.traits.sanity = 2;
        core.currentExplorerTraits = { ...core.currentExplorer.traits };
        core.scenarioRuntime.deadExplorerPlayerIds = ['0'];
        core.monsters = core.monsters.map((monster) => (
            monster.id === monsterId
                ? { ...monster, roomId: hero.roomId, sanity: 6 }
                : monster
        ));

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.PHANTOM_PHOTOGRAPHER_ATTACK,
            '1',
            { monsterId, targetPlayerId: '2' },
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 3, 3, 1, 1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult?.hauntId).toBe('magic-camera');
        expect(core.endgameResult?.outcome).toBe('traitor');
        expect(core.endgameResult?.winners).toEqual(['1']);
    });
});
