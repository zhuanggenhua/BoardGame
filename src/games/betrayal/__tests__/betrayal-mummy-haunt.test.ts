import { describe, expect, it } from 'vitest';
import {
    resolveExplorableRoomSlots,
    resolveRoomPlacementPreview,
} from '../roomDiscoveryModel';
import {
    resolveBetrayalMonsterDamageOutcome,
    resolveBetrayalMonsterStatuses,
} from '../monsterReadModel';
import {
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createCorpseLootReadyCore,
    createFirstScenarioHauntCore,
    createStartedFirstScenarioCore,
    setScenarioTestTurnMovement,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    resolveInventoryEffectId,
    findTestExplorer,
    activateTestExplorer,
    setTestExplorerRoom,
    setTestExplorerInventory,
    setNextDiscoverySymbolRoomsForAllFloors,
    setTestTraitTrack,
    setHighCapacityPhysicalDamageTracks,
    setDiscoveredTestRoom,
    placeActiveTestExplorerInRoom,
    createDustHauntCore,
    createMagicCameraHauntCore,
    createHelpingHandsHauntCore,
    type BetrayalCore,
} from './helpers/firstScenarioRuntimeHarness';
import {
    resolveMummyPendingAttackReward,
    resolveMummyStealableCards,
} from '../hauntAttackRewardReadModel';
import { resolveBetrayalHauntRevealProtocol } from '../hauntSetupModel';
import { resolveBetrayalReferenceCardAccess } from '../referencePresentation';
import {
    resolveBetrayalMonsterActionPanel,
    resolveBetrayalMonsterMoveCost,
    resolveBetrayalMonsterMoveTargetRooms,
    resolveBetrayalMonsterTurnRuntimeState,
    resolveBetrayalNormalMonsterAttackTargets,
} from '../monsterActionReadModel';
import { resolveBetrayalHauntTokenInstances } from '../hauntTokenModel';
import { resolveBetrayalNumberTracks } from '../hauntProgress';

describe('Betrayal first scenario runtime - mummy haunt', () => {
it('木乃伊横行作祟揭示读模型先列公开介绍和设置，再分开阅读秘密目标', () => {
        const core = createFirstScenarioHauntCore();
        const protocol = resolveBetrayalHauntRevealProtocol(core);

        expect(protocol.active).toBe(true);
        expect(protocol.hauntCardNumber).toBe(1);
        expect(core.scenarioRuntime.hauntScenarioCardId).toBe('mummy-rampage');
        expect(core.scenarioRuntime.hauntScenarioCardTitle).toBe('木乃伊横行');
        expect(protocol.hauntType).toBe('one-traitor');
        expect(protocol.publicSteps.map((step) => step.id)).toEqual([
            'heroes-intro',
            'heroes-setup',
            'traitor-intro',
            'traitor-setup',
        ]);
        expect(protocol.setupQueue.map((entry) => entry.id)).toEqual([
            'assign-revealer-traitor',
            'traitor-remains-in-game',
            'place-mummy-and-sarcophagus',
            'place-girl-token',
            'prepare-mummy-knowledge-tokens',
            'monster-card-left-of-traitor',
            'first-player-left-of-traitor',
        ]);
        expect(protocol.setupQueue.filter((entry) => entry.status === 'resolved').map((entry) => entry.id)).toEqual([
            'assign-revealer-traitor',
            'traitor-remains-in-game',
            'place-mummy-and-sarcophagus',
            'place-girl-token',
            'first-player-left-of-traitor',
        ]);
        expect(protocol.secretBoundary).toEqual({
            heroBookVisibleTo: 'heroes',
            traitorBookVisibleTo: 'traitor',
            revealOnUse: true,
        });
    });

it('参考资料权限读模型按作祟阶段、阵营和怪物运行态开放', () => {
        const preHauntCore = createStartedFirstScenarioCore();
        const preHauntReferences = resolveBetrayalReferenceCardAccess(preHauntCore, '0');
        expect(preHauntReferences.find((entry) => entry.id === 'player-reference-front')).toMatchObject({
            active: true,
            visibleTo: 'all',
            viewerCanOpen: true,
            source: 'base-rule',
        });
        expect(preHauntReferences.find((entry) => entry.id === 'heroes-book')).toMatchObject({
            active: false,
            visibleTo: 'none',
            viewerCanOpen: false,
            reason: '作祟尚未开始，不能打开作祟剧本书。',
        });

        const crimsonJackCore = createFirstScenarioHauntCore();
        const traitorPlayerId = crimsonJackCore.scenarioRuntime.traitorPlayerId!;
        const heroPlayerId = crimsonJackCore.playerIds.find((playerId) => playerId !== traitorPlayerId)!;
        const traitorReferences = resolveBetrayalReferenceCardAccess(crimsonJackCore, traitorPlayerId);
        const heroReferences = resolveBetrayalReferenceCardAccess(crimsonJackCore, heroPlayerId);
        expect(traitorReferences.find((entry) => entry.id === 'traitor-book')).toMatchObject({
            active: true,
            visibleTo: 'traitor',
            viewerSide: 'traitor',
            viewerCanOpen: true,
            source: 'haunt-protocol',
        });
        expect(traitorReferences.find((entry) => entry.id === 'heroes-book')).toMatchObject({
            active: true,
            visibleTo: 'heroes',
            viewerCanOpen: false,
        });
        expect(heroReferences.find((entry) => entry.id === 'heroes-book')).toMatchObject({
            active: true,
            visibleTo: 'heroes',
            viewerSide: 'hero',
            viewerCanOpen: true,
        });
        expect(heroReferences.find((entry) => entry.id === 'traitor-book')).toMatchObject({
            active: true,
            visibleTo: 'traitor',
            viewerCanOpen: false,
        });

        const dustCore = createDustHauntCore();
        const hiddenTraitorReferences = resolveBetrayalReferenceCardAccess(dustCore, '0');
        expect(hiddenTraitorReferences.find((entry) => entry.id === 'heroes-book')).toMatchObject({
            active: true,
            visibleTo: 'all',
            viewerCanOpen: true,
        });
        expect(hiddenTraitorReferences.find((entry) => entry.id === 'traitor-book')).toMatchObject({
            active: false,
            visibleTo: 'none',
            viewerCanOpen: false,
            reason: '该作祟当前没有公开叛徒书入口，避免泄露隐藏身份或不存在的秘密段落。',
        });

        const magicCameraCore = createMagicCameraHauntCore('1');
        expect(resolveBetrayalReferenceCardAccess(magicCameraCore, '0')
            .find((entry) => entry.id === 'monster-reference-card')).toMatchObject({
            active: true,
            visibleTo: 'all',
            viewerCanOpen: true,
            source: 'monster-box',
            representativeOnly: true,
        });
    });

it('木乃伊横行作祟目标计数轨按知识标记进度派生', () => {
        const mummyCore = createFirstScenarioHauntCore();
        const mummyTrack = resolveBetrayalNumberTracks(mummyCore)
            .find((track) => track.id === 'mummy-knowledge-tokens');

        expect(mummyTrack).toMatchObject({
            kind: 'haunt-objective',
            label: '知识标记',
            value: 0,
            min: 0,
            max: 2,
            targetValue: 2,
            currentLabel: '0/2',
            targetLabel: '2 枚知识标记',
            statusLabel: '寻找木乃伊真名',
            progressPercent: 0,
            source: 'haunt-contract',
            representativeOnly: true,
        });
        expect(resolveBetrayalNumberTracks(mummyCore)
            .find((track) => track.id === 'crimson-jack-exorcism-circles')).toBeUndefined();

        const dustCore = createDustHauntCore();
        dustCore.scenarioRuntime.dust!.researchRoomIds = ['ground-north', 'upper-west'];
        const dustTrack = resolveBetrayalNumberTracks(dustCore)
            .find((track) => track.id === 'dust-research-tokens');

        expect(dustTrack).toMatchObject({
            kind: 'haunt-objective',
            label: '研究 token',
            value: 2,
            max: 8,
            currentLabel: '2/8',
            statusLabel: '治愈检定 +4',
            progressPercent: 25,
            representativeOnly: true,
        });
    });

it('作祟 token 目录统一列出现有标记、目标、怪物、疾病和尸体', () => {
        const markerCore = createStartedFirstScenarioCore(['0', '1', '2']);
        markerCore.rooms = markerCore.rooms.map((room) => (
            room.id === 'ground-north'
                ? { ...room, markerTokens: ['obstacle', 'secretPassage'] }
                : room
        ));
        const markerTokens = resolveBetrayalHauntTokenInstances(markerCore)
            .filter((token) => token.kind === 'room-marker');
        expect(markerTokens.map((token) => [token.label, token.roomId, token.visibility]).sort()).toEqual([
            ['秘密通道', 'ground-north', 'public'],
            ['障碍物', 'ground-north', 'public'],
        ]);
        expect(markerTokens.every((token) => token.visibleToPlayerIds.length === 3)).toBe(true);

        const mummyCore = createFirstScenarioHauntCore();
        const mummyTokens = resolveBetrayalHauntTokenInstances(mummyCore);
        expect(mummyTokens.find((token) => token.id === 'mummy-sarcophagus')).toMatchObject({
            kind: 'haunt-objective',
            label: '石棺',
            visibility: 'public',
            source: 'haunt-contract',
            representativeOnly: true,
        });
        expect(mummyTokens.find((token) => token.id === 'mummy-girl-token')).toMatchObject({
            kind: 'haunt-resource',
            label: '女孩',
            asset: 'betrayal/tokens/haunts/mummy-girl.svg',
            visibility: 'public',
            source: 'haunt-contract',
            representativeOnly: true,
        });
        expect(mummyTokens.find((token) => token.id === 'monster-mummy')).toMatchObject({
            kind: 'monster',
            label: '木乃伊',
            status: 'active',
            source: 'monster-box',
            representativeOnly: true,
        });

        const dustCore = createDustHauntCore();
        dustCore.scenarioRuntime.dust!.researchRoomIds = ['ground-north'];
        const dustViewForPlayer1 = BetrayalDomain.playerView?.(dustCore, '1') as BetrayalCore;
        const dustTokens = resolveBetrayalHauntTokenInstances(dustViewForPlayer1);
        const ownSicknessTokens = dustTokens.filter((token) => token.kind === 'sickness' && token.ownerPlayerId === '1');
        const hiddenSicknessTokens = dustTokens.filter((token) => token.kind === 'sickness' && token.ownerPlayerId === '0');
        expect(ownSicknessTokens).toHaveLength(3);
        expect(ownSicknessTokens.every((token) => (
            token.visibility === 'owner-only'
            && token.visibleToPlayerIds.join(',') === '1'
            && token.value !== null
            && !token.valueHidden
        ))).toBe(true);
        expect(hiddenSicknessTokens).toHaveLength(3);
        expect(hiddenSicknessTokens.every((token) => token.value === null && token.valueHidden)).toBe(true);
        expect(dustTokens.find((token) => token.id === 'dust-research-token-ground-north')).toMatchObject({
            kind: 'haunt-objective',
            label: '研究 token',
            roomId: 'ground-north',
            source: 'haunt-contract',
        });

        const helpingHandsCore = createHelpingHandsHauntCore();
        const trollHandTokens = resolveBetrayalHauntTokenInstances(helpingHandsCore)
            .filter((token) => token.kind === 'monster' && token.label === '巨魔手');
        expect(trollHandTokens).toHaveLength(2);
        expect(trollHandTokens.map((token) => token.asset).sort()).toEqual([
            'betrayal/tokens/monsters/troll-left-hand',
            'betrayal/tokens/monsters/troll-right-hand',
        ]);
        expect(trollHandTokens.every((token) => token.status === 'active' && token.source === 'monster-box')).toBe(true);

        const corpseCore = createCorpseLootReadyCore();
        const corpseExplorer = findTestExplorer(corpseCore, '0');
        expect(resolveBetrayalHauntTokenInstances(corpseCore)
            .find((token) => token.id === 'corpse-0')).toMatchObject({
            kind: 'corpse',
            label: `${corpseExplorer.displayName}尸体`,
            roomId: 'hallway',
            ownerPlayerId: '0',
            value: 2,
            status: 'lootable',
            source: 'death-rule',
        });
    });

it('木乃伊横行 setup 创建木乃伊、石棺、女孩和 0/2 知识进度', () => {
        const core = createFirstScenarioHauntCore();
        const mummy = core.monsters.find((monster) => monster.definitionId === 'mummy');
        const mummyRuntime = core.scenarioRuntime.mummy;
        const tokens = resolveBetrayalHauntTokenInstances(core);
        const knowledgeTrack = resolveBetrayalNumberTracks(core)
            .find((track) => track.id === 'mummy-knowledge-tokens');

        expect(core.scenarioRuntime.hauntScenarioCardId).toBe('mummy-rampage');
        expect(core.scenarioRuntime.hauntScenarioCardTitle).toBe('木乃伊横行');
        expect(mummyRuntime).toMatchObject({
            mummyMonsterId: 'mummy',
            knowledgeTokenCount: 0,
            trueNameFound: false,
            banishmentSpellLearned: false,
            requiredOmenIds: ['omen-book', 'holy-symbol', 'ring'],
        });
        expect(mummy).toMatchObject({
            id: 'mummy',
            name: '木乃伊',
            roomId: mummyRuntime?.sarcophagusRoomId,
            might: 8,
            speed: 3,
            sanity: 5,
        });
        expect(tokens.find((token) => token.id === 'mummy-sarcophagus')).toMatchObject({
            label: '石棺',
            roomId: mummyRuntime?.sarcophagusRoomId,
            visibility: 'public',
        });
        expect(tokens.find((token) => token.id === 'mummy-girl-token')).toMatchObject({
            label: '女孩',
            roomId: mummyRuntime?.girlRoomId,
            visibility: 'public',
        });
        expect(core.rooms.find((room) => room.id === mummyRuntime?.girlRoomId)).toMatchObject({
            state: 'discovered',
        });
        expect(knowledgeTrack).toMatchObject({
            value: 0,
            currentLabel: '0/2',
            statusLabel: '寻找木乃伊真名',
        });
    });

it('木乃伊受普通正数伤害时按通用怪物规则击晕但不触发英雄胜利', () => {
        let core = createFirstScenarioHauntCore();

        expect(resolveBetrayalMonsterDamageOutcome(core, 'mummy', {
            damageAmount: 1,
            damageTrait: 'might',
        })).toMatchObject({
            monsterId: 'mummy',
            name: '木乃伊',
            kind: 'stunned',
            previousStatus: 'active',
            nextStatus: 'stunned',
            canBeStunned: true,
            stunned: true,
            killed: false,
            removedFromHouse: false,
            logLabel: '击晕木乃伊',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE, '0', {
                monsterId: 'mummy',
                damageAmount: 1,
                damageTrait: 'might',
            }),
        ).valid).toBe(true);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MONSTER_DAMAGE, '0', {
            monsterId: 'mummy',
            damageAmount: 1,
            damageTrait: 'might',
        });

        expect(core.phase).toBe('haunt');
        expect(core.endgameResult).toBeNull();
        expect(resolveBetrayalMonsterStatuses(core).find((status) => status.monsterId === 'mummy')).toMatchObject({
            status: 'stunned',
            stunned: true,
            canBeStunned: true,
            slowsHeroMovement: false,
        });
        expect(core.activityLog.some((entry) => entry.text.includes('击晕木乃伊'))).toBe(true);
    });

it('木乃伊横行英雄线可找真名、学驱逐法术并同房驱逐木乃伊', () => {
        let core = createFirstScenarioHauntCore();
        const heroId = '0';
        const traitorId = core.scenarioRuntime.traitorPlayerId!;

        expect(traitorId).not.toBe(heroId);
        expect(findTestExplorer(core, heroId).inventory).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'omen-book', name: '书本' }),
        ]));

        placeActiveTestExplorerInRoom(core, heroId, 'upper-west');
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.STUDY_MUMMY_NAME,
            heroId,
            {},
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );
        expect(core.scenarioRuntime.mummy).toMatchObject({
            knowledgeTokenCount: 1,
            trueNameFound: true,
            banishmentSpellLearned: false,
        });
        expect(resolveBetrayalNumberTracks(core)
            .find((track) => track.id === 'mummy-knowledge-tokens')).toMatchObject({
            value: 1,
            currentLabel: '1/2',
            statusLabel: '继续学习驱逐法术',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
        placeActiveTestExplorerInRoom(core, heroId, 'upper-west');
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.LEARN_MUMMY_BANISHMENT,
            heroId,
            {},
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3),
        );
        expect(core.scenarioRuntime.mummy).toMatchObject({
            knowledgeTokenCount: 2,
            trueNameFound: true,
            banishmentSpellLearned: true,
        });
        expect(resolveBetrayalNumberTracks(core)
            .find((track) => track.id === 'mummy-knowledge-tokens')).toMatchObject({
            value: 2,
            currentLabel: '2/2',
            statusLabel: '驱逐法术已就绪',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '1', {});
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '2', {});
        placeActiveTestExplorerInRoom(core, heroId, core.scenarioRuntime.mummy!.sarcophagusRoomId);
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.BANISH_MUMMY,
            heroId,
            {},
            100,
            createBetrayalScriptedRandom(3, 3, 3, 3, 1, 1, 1, 1, 1),
        );

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'mummy-rampage',
            hauntTitle: '木乃伊横行',
            outcome: 'survivors',
            traitorPlayerId: traitorId,
        });
        expect(core.endgameResult?.winners).toEqual(['0', '1']);
    });

it('木乃伊横行叛徒线可让木乃伊带女孩和圣符回石棺获胜', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const mummyRuntime = core.scenarioRuntime.mummy!;
        const sarcophagusRoomId = mummyRuntime.sarcophagusRoomId;
        const girlRoomId = mummyRuntime.girlRoomId!;
        const mummyMonsterId = mummyRuntime.mummyMonsterId;

        placeActiveTestExplorerInRoom(core, traitorId, girlRoomId);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.PICK_UP_MUMMY_GIRL, traitorId, {});

        expect(core.scenarioRuntime.mummy).toMatchObject({
            girlRoomId: null,
            girlHolderPlayerId: traitorId,
            girlHeldByMummy: false,
        });
        expect(resolveBetrayalHauntTokenInstances(core)
            .find((token) => token.id === 'mummy-girl-token')).toMatchObject({
                status: 'held-by-player',
                ownerPlayerId: traitorId,
                visibility: 'public',
            });

        const stagingRoom = core.rooms.find((room) => {
            if (room.id === sarcophagusRoomId || room.state !== 'discovered') {
                return false;
            }
            core.monsters = core.monsters.map((monster) => (
                monster.id === mummyMonsterId
                    ? { ...monster, roomId: room.id }
                    : monster
            ));
            return resolveBetrayalMonsterMoveTargetRooms(core, mummyMonsterId)
                .some((targetRoom) => targetRoom.id === sarcophagusRoomId);
        });
        expect(stagingRoom).toBeTruthy();
        const stagingRoomId = stagingRoom!.id;
        core.monsters = core.monsters.map((monster) => (
            monster.id === mummyMonsterId
                ? { ...monster, roomId: stagingRoomId }
                : monster
        ));

        placeActiveTestExplorerInRoom(core, traitorId, stagingRoomId);
        setTestExplorerInventory(core, traitorId, [{ id: 'holy-symbol', name: '圣符', kind: 'omen' }]);
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.GIVE_GIRL_TO_MUMMY, traitorId, {});

        expect(core.scenarioRuntime.mummy).toMatchObject({
            girlRoomId: null,
            girlHolderPlayerId: null,
            girlHeldByMummy: true,
        });
        expect(resolveBetrayalHauntTokenInstances(core)
            .find((token) => token.id === 'mummy-girl-token')).toMatchObject({
                roomId: stagingRoomId,
                ownerName: '木乃伊',
                status: 'held-by-mummy',
                visibility: 'public',
            });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.GIVE_OMEN_TO_MUMMY, traitorId, { cardId: 'holy-symbol' });

        expect(core.phase).toBe('haunt');
        expect(core.scenarioRuntime.mummy?.mummyCarriedOmenIds).toEqual(['holy-symbol']);
        expect(core.currentExplorer.inventory).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'holy-symbol' }),
        ]));

        core.scenarioRuntime.monsterTurn = {
            ...core.scenarioRuntime.monsterTurn,
            moveRemainingById: {
                ...core.scenarioRuntime.monsterTurn.moveRemainingById,
                [mummyMonsterId]: 3,
            },
        };
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, traitorId, {
            monsterId: mummyMonsterId,
            roomId: sarcophagusRoomId,
        });

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'mummy-rampage',
            hauntTitle: '木乃伊横行',
            outcome: 'traitor',
            traitorPlayerId: traitorId,
        });
        expect(core.endgameResult?.winners).toEqual([traitorId]);
    });

it('木乃伊横行后续英雄和叛徒探索预兆时会强制找出关键预兆并洗牌', () => {
        const prepareForcedOmenExplore = (
            actorId: string,
            omenDeck: BetrayalCore['possessionOrderByKind']['omen'],
        ) => {
            const core = createFirstScenarioHauntCore();
            activateTestExplorer(core, actorId);
            for (const playerId of core.playerIds) {
                setTestExplorerInventory(
                    core,
                    playerId,
                    findTestExplorer(core, playerId).inventory.filter((card) => (
                        !['omen-book', 'holy-symbol', 'ring'].includes(resolveInventoryEffectId(card.id))
                    )),
                );
            }
            if (core.scenarioRuntime.mummy) {
                core.scenarioRuntime.mummy.mummyCarriedCards = [];
                core.scenarioRuntime.mummy.mummyCarriedOmenIds = [];
            }
            core.possessionOrderByKind.omen = omenDeck.map((card) => ({ ...card }));
            core.drawOrder = ['omen'];
            setNextDiscoverySymbolRoomsForAllFloors(core, 'omen');
            core.turnEndedByDiscovery = false;
            setScenarioTestTurnMovement(core, 6);
            const exploration = resolveExplorableRoomSlots(core)
                .map((slot) => ({
                    slot,
                    preview: resolveRoomPlacementPreview(core, { roomId: slot.id }),
                }))
                .find(({ preview }) => (
                    preview?.deckKind === 'omen'
                    && (!preview.requiresTileAdjustment || preview.tileAdjustmentOptions[0])
                ));
            expect(exploration).toBeDefined();
            const preview = exploration!.preview!;
            return applyBetrayalCommand(core, BETRAYAL_COMMANDS.EXPLORE_ROOM, actorId, {
                roomId: exploration!.slot.id,
                orientationTurns: preview.defaultOrientationTurns,
                roomTileAdjustment: preview.requiresTileAdjustment
                    ? preview.tileAdjustmentOptions[0]
                    : undefined,
            });
        };

        const heroCore = createFirstScenarioHauntCore();
        const heroId = heroCore.playerIds.find((playerId) => playerId !== heroCore.scenarioRuntime.traitorPlayerId)!;
        const afterHeroExplore = prepareForcedOmenExplore(heroId, [
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'omen-book', name: '书本', kind: 'omen' },
            { id: 'mask', name: '面具', kind: 'omen' },
        ]);
        expect(afterHeroExplore.latestDiscovery).toMatchObject({
            title: '书本',
            summary: '已加入持有区',
        });
        expect(afterHeroExplore.latestDiscovery?.detail).toContain('木乃伊横行：英雄首次需要预兆时，从预兆堆找出书本并洗牌');
        expect(findTestExplorer(afterHeroExplore, heroId).inventory.map((card) => resolveInventoryEffectId(card.id))).toContain('omen-book');
        expect(afterHeroExplore.possessionOrderByKind.omen.map((card) => resolveInventoryEffectId(card.id))).not.toContain('omen-book');

        const traitorCore = createFirstScenarioHauntCore();
        const traitorId = traitorCore.scenarioRuntime.traitorPlayerId!;
        const afterTraitorExplore = prepareForcedOmenExplore(traitorId, [
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: 'holy-symbol', name: '圣符', kind: 'omen' },
            { id: 'ring', name: '指环', kind: 'omen' },
        ]);
        expect(afterTraitorExplore.latestDiscovery).toMatchObject({
            title: '圣符',
            summary: '已加入持有区',
        });
        expect(afterTraitorExplore.latestDiscovery?.detail).toContain('木乃伊横行：叛徒首次需要预兆时，从预兆堆找出圣符或指环并洗牌');
        expect(findTestExplorer(afterTraitorExplore, traitorId).inventory.map((card) => resolveInventoryEffectId(card.id))).toContain('holy-symbol');
        expect(afterTraitorExplore.possessionOrderByKind.omen.map((card) => resolveInventoryEffectId(card.id))).not.toContain('holy-symbol');
    });

it('木乃伊移动骰为 0 或 1 时可瞬移到任意已发现房间并自动拾起女孩', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const mummyRuntime = core.scenarioRuntime.mummy!;
        const mummyMonsterId = mummyRuntime.mummyMonsterId;
        const mummyRoomId = core.monsters.find((monster) => monster.id === mummyMonsterId)?.roomId;
        const girlRoomId = mummyRuntime.girlRoomId!;
        const quietRoomId = core.rooms.find((room) => (
            room.state === 'discovered'
            && room.id !== mummyRoomId
            && room.id !== girlRoomId
        ))?.id ?? girlRoomId;
        activateTestExplorer(core, traitorId);
        for (const playerId of core.playerIds.filter((playerId) => playerId !== traitorId)) {
            findTestExplorer(core, playerId).roomId = quietRoomId;
        }

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            traitorId,
            { groupId: '木乃伊:3' },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        expect(resolveBetrayalMonsterTurnRuntimeState(core).movementRollsByGroupId['木乃伊:3']).toMatchObject({
            dice: [0, 0, 0],
            total: 0,
            moveAllowance: 0,
        });
        expect(resolveBetrayalMonsterMoveTargetRooms(core, mummyMonsterId).map((room) => room.id)).toContain(girlRoomId);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, traitorId, {
            monsterId: mummyMonsterId,
            roomId: girlRoomId,
        });

        expect(core.monsters.find((monster) => monster.id === mummyMonsterId)?.roomId).toBe(girlRoomId);
        expect(core.scenarioRuntime.mummy).toMatchObject({
            girlRoomId: null,
            girlHolderPlayerId: null,
            girlHeldByMummy: true,
        });
        expect(resolveBetrayalMonsterTurnRuntimeState(core).movedMonsterIdsThisTurn).toContain(mummyMonsterId);
        expect(resolveBetrayalMonsterTurnRuntimeState(core).moveRemainingById[mummyMonsterId]).toBe(0);
    });

it('木乃伊普通移动与叛徒同房时只消耗 1 点并可继续连续移动', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const mummyRuntime = core.scenarioRuntime.mummy!;
        const mummyMonsterId = mummyRuntime.mummyMonsterId;
        const mummyRoomId = core.monsters.find((monster) => monster.id === mummyMonsterId)?.roomId;
        if (!mummyRoomId) {
            throw new Error('木乃伊连续移动测试夹具缺少木乃伊房间');
        }
        const quietRoomId = core.rooms.find((room) => (
            room.state === 'discovered'
            && room.id !== mummyRoomId
            && room.id !== mummyRuntime.girlRoomId
        ))?.id ?? mummyRuntime.girlRoomId!;
        activateTestExplorer(core, traitorId);
        setTestExplorerRoom(core, traitorId, mummyRoomId);
        for (const playerId of core.playerIds.filter((playerId) => playerId !== traitorId)) {
            setTestExplorerRoom(core, playerId, quietRoomId);
        }

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            traitorId,
            { groupId: '木乃伊:3' },
            100,
            createBetrayalScriptedRandom(2, 2, 2),
        );

        expect(resolveBetrayalMonsterTurnRuntimeState(core).movementRollsByGroupId['木乃伊:3']).toMatchObject({
            dice: [1, 1, 1],
            total: 3,
            moveAllowance: 3,
        });
        expect(resolveBetrayalMonsterMoveCost(core, mummyMonsterId)).toBe(1);
        const targetRoom = resolveBetrayalMonsterMoveTargetRooms(core, mummyMonsterId)[0];
        expect(targetRoom).toBeDefined();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, traitorId, {
            monsterId: mummyMonsterId,
            roomId: targetRoom!.id,
        });

        expect(core.monsters.find((monster) => monster.id === mummyMonsterId)?.roomId).toBe(targetRoom!.id);
        expect(resolveBetrayalMonsterTurnRuntimeState(core).moveRemainingById[mummyMonsterId]).toBe(2);
        expect(resolveBetrayalMonsterMoveTargetRooms(core, mummyMonsterId).length).toBeGreaterThan(0);
        expect(resolveBetrayalMonsterActionPanel(core).slots.find((slot) => slot.id === `move:${mummyMonsterId}`)).toMatchObject({
            enabled: true,
        });
    });

it('木乃伊移动骰为 0 或 1 时可跨楼层选择已发现房间，但不能去未发现房间', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const mummyRuntime = core.scenarioRuntime.mummy!;
        const mummyMonsterId = mummyRuntime.mummyMonsterId;
        const mummyRoomId = core.monsters.find((monster) => monster.id === mummyMonsterId)?.roomId;
        const upperTarget = core.rooms.find((room) => room.floor === 'upper' && room.id !== mummyRoomId);
        const basementTarget = core.rooms.find((room) => room.floor === 'basement' && room.id !== mummyRoomId);
        if (!mummyRoomId || !upperTarget || !basementTarget) {
            throw new Error('木乃伊跨楼层移动测试夹具缺少目标房间');
        }
        setDiscoveredTestRoom(core, upperTarget.id, { name: '上层测试房间', floor: 'upper' });
        setDiscoveredTestRoom(core, basementTarget.id, { name: '地下测试房间', floor: 'basement' });
        const unrevealedRoom = core.rooms.find((room) => (
            room.state !== 'discovered'
            && room.id !== upperTarget.id
            && room.id !== basementTarget.id
        ));
        if (!unrevealedRoom) {
            throw new Error('木乃伊跨楼层移动测试夹具缺少未发现房间');
        }
        const quietRoomId = core.rooms.find((room) => (
            room.state === 'discovered'
            && room.id !== mummyRoomId
            && room.id !== upperTarget.id
            && room.id !== basementTarget.id
        ))?.id ?? upperTarget.id;
        activateTestExplorer(core, traitorId);
        for (const playerId of core.playerIds.filter((playerId) => playerId !== traitorId)) {
            setTestExplorerRoom(core, playerId, quietRoomId);
        }

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            traitorId,
            { groupId: '木乃伊:3' },
            100,
            createBetrayalScriptedRandom(1, 1, 1),
        );

        const targetRoomIds = resolveBetrayalMonsterMoveTargetRooms(core, mummyMonsterId)
            .map((room) => room.id);
        expect(targetRoomIds).toContain(upperTarget.id);
        expect(targetRoomIds).toContain(basementTarget.id);
        expect(targetRoomIds).not.toContain(mummyRoomId);
        expect(targetRoomIds).not.toContain(unrevealedRoom.id);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, traitorId, {
                monsterId: mummyMonsterId,
                roomId: unrevealedRoom.id,
            }),
        )).toMatchObject({
            valid: false,
            error: '怪物只能移动到已发现且真实连接的房间。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_MONSTER_TO_ROOM, traitorId, {
            monsterId: mummyMonsterId,
            roomId: upperTarget.id,
        });

        expect(core.monsters.find((monster) => monster.id === mummyMonsterId)?.roomId).toBe(upperTarget.id);
    });

it('木乃伊与英雄同房且未攻击时必须先攻击，不能先移动', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const [heroId, deadHeroId] = core.playerIds.filter((playerId) => playerId !== traitorId);
        if (!heroId || !deadHeroId) {
            throw new Error('木乃伊同房先攻击测试夹具缺少英雄');
        }
        const mummyMonsterId = core.scenarioRuntime.mummy!.mummyMonsterId;
        const mummyRoomId = core.monsters.find((monster) => monster.id === mummyMonsterId)!.roomId;
        activateTestExplorer(core, traitorId);
        setTestExplorerRoom(core, traitorId, mummyRoomId);
        setTestExplorerRoom(core, heroId, mummyRoomId);
        setTestExplorerRoom(core, deadHeroId, mummyRoomId);
        core.scenarioRuntime.deadExplorerPlayerIds = [deadHeroId];

        expect(resolveBetrayalMonsterMoveCost(core, mummyMonsterId)).toBe(2);
        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.ROLL_MONSTER_MOVEMENT_GROUP,
            traitorId,
            { groupId: '木乃伊:3' },
            100,
            createBetrayalScriptedRandom(3, 3, 3),
        );

        expect(resolveBetrayalMonsterMoveTargetRooms(core, mummyMonsterId)).toEqual([]);
        expect(resolveBetrayalMonsterActionPanel(core).slots.find((slot) => slot.id === `move:${mummyMonsterId}`)).toMatchObject({
            enabled: false,
            reason: '木乃伊与英雄同房且尚未攻击，必须先攻击。',
        });
        expect(resolveBetrayalNormalMonsterAttackTargets(core, mummyMonsterId)).toMatchObject({
            targetPlayerIds: [heroId],
            canResolveWithExistingCommand: true,
        });
        expect(resolveBetrayalNormalMonsterAttackTargets(core, mummyMonsterId)?.targetPlayerIds).not.toContain(traitorId);
        expect(resolveBetrayalNormalMonsterAttackTargets(core, mummyMonsterId)?.targetPlayerIds).not.toContain(deadHeroId);
    });

it('英雄回合不显示也不能执行普通木乃伊动作，叛徒回合才开放怪物动作', () => {
        const core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const heroId = core.playerIds.find((playerId) => playerId !== traitorId)!;
        const mummyMonsterId = core.scenarioRuntime.mummy!.mummyMonsterId;

        expect(core.currentPlayer).toBe(heroId);
        expect(resolveBetrayalMonsterActionPanel(core)).toMatchObject({
            active: false,
            reason: '当前是玩家回合，等待怪物控制者回合后才能处理怪物动作。',
            slots: [],
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(
                BETRAYAL_COMMANDS.RESOLVE_MONSTER_TURN_START,
                heroId,
                { monsterId: mummyMonsterId },
            ),
        )).toMatchObject({
            valid: false,
            error: '只有当前叛徒能执行普通怪物回合动作。',
        });

        activateTestExplorer(core, traitorId);
        const traitorPanel = resolveBetrayalMonsterActionPanel(core);
        expect(traitorPanel.slots.find((slot) => slot.id === `turn-start:${mummyMonsterId}`)).toMatchObject({
            enabled: true,
        });
    });

it('木乃伊攻击造成 2 点以上伤害后可选择偷取女孩或物品代替伤害', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const heroId = core.playerIds.find((playerId) => playerId !== traitorId)!;
        const mummyMonsterId = core.scenarioRuntime.mummy!.mummyMonsterId;
        const mummyRoomId = core.monsters.find((monster) => monster.id === mummyMonsterId)!.roomId;
        activateTestExplorer(core, traitorId);
        findTestExplorer(core, heroId).roomId = mummyRoomId;
        setHighCapacityPhysicalDamageTracks(core, heroId);
        setTestExplorerInventory(core, heroId, [
            { id: 'map', name: '地图', kind: 'item' },
            { id: 'holy-symbol', name: '圣符', kind: 'omen' },
        ]);
        core.scenarioRuntime.mummy = {
            ...core.scenarioRuntime.mummy!,
            girlRoomId: null,
            girlHolderPlayerId: heroId,
            girlHeldByMummy: false,
            mummyCarriedCards: [],
            mummyCarriedOmenIds: [],
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            traitorId,
            { monsterId: mummyMonsterId, targetPlayerId: heroId },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 1, 1, 1, 1, 1),
        );

        expect(core.pendingDamageAllocation).toBeNull();
        expect(resolveMummyPendingAttackReward(core)).toMatchObject({
            controllerPlayerId: traitorId,
            monsterId: mummyMonsterId,
            defenderPlayerId: heroId,
        });
        expect(resolveMummyStealableCards(core, heroId).map((card) => card.id)).toEqual([
            'map',
            'holy-symbol',
            'mummy-girl-token',
        ]);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD, traitorId, {
            choice: 'steal',
            cardId: 'holy-symbol',
        });

        expect(resolveMummyPendingAttackReward(core)).toBeNull();
        expect(findTestExplorer(core, heroId).inventory.map((card) => card.id)).toEqual(['map']);
        expect(core.scenarioRuntime.mummy?.mummyCarriedCards.map((card) => card.id)).toEqual(['holy-symbol']);
        expect(core.scenarioRuntime.mummy?.mummyCarriedOmenIds).toEqual(['holy-symbol']);

        let girlCore = createFirstScenarioHauntCore();
        const girlTraitorId = girlCore.scenarioRuntime.traitorPlayerId!;
        const girlHeroId = girlCore.playerIds.find((playerId) => playerId !== girlTraitorId)!;
        const girlMummyMonsterId = girlCore.scenarioRuntime.mummy!.mummyMonsterId;
        const girlMummyRoomId = girlCore.monsters.find((monster) => monster.id === girlMummyMonsterId)!.roomId;
        activateTestExplorer(girlCore, girlTraitorId);
        findTestExplorer(girlCore, girlHeroId).roomId = girlMummyRoomId;
        setHighCapacityPhysicalDamageTracks(girlCore, girlHeroId);
        setTestExplorerInventory(girlCore, girlHeroId, [{ id: 'map', name: '地图', kind: 'item' }]);
        girlCore.scenarioRuntime.mummy = {
            ...girlCore.scenarioRuntime.mummy!,
            girlRoomId: null,
            girlHolderPlayerId: girlHeroId,
            girlHeldByMummy: false,
        };

        girlCore = applyBetrayalCommand(
            girlCore,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            girlTraitorId,
            { monsterId: girlMummyMonsterId, targetPlayerId: girlHeroId },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 1, 1, 1, 1, 1),
        );
        girlCore = applyBetrayalCommand(girlCore, BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD, girlTraitorId, {
            choice: 'steal',
            cardId: 'mummy-girl-token',
        });

        expect(girlCore.scenarioRuntime.mummy).toMatchObject({
            girlRoomId: null,
            girlHolderPlayerId: null,
            girlHeldByMummy: true,
        });
    });

it('木乃伊攻击奖励阶段的攻击骰盘必须由本局玩家各确认一次，不能由一人代替全员确认', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const heroId = core.playerIds.find((playerId) => playerId !== traitorId)!;
        const remainingPlayerIds = core.playerIds.filter((playerId) => playerId !== traitorId);
        const mummyMonsterId = core.scenarioRuntime.mummy!.mummyMonsterId;
        const mummyRoomId = core.monsters.find((monster) => monster.id === mummyMonsterId)!.roomId;
        activateTestExplorer(core, traitorId);
        findTestExplorer(core, heroId).roomId = mummyRoomId;
        setHighCapacityPhysicalDamageTracks(core, heroId);
        setTestExplorerInventory(core, heroId, [
            { id: 'map', name: '地图', kind: 'item' },
        ]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            traitorId,
            { monsterId: mummyMonsterId, targetPlayerId: heroId },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 1, 1, 1, 1, 1),
        );
        expect(core.recentRoll).toMatchObject({
            kind: 'attackRoll',
            playerId: traitorId,
        });
        expect(core.activePlayerId).toBe(traitorId);
        expect(resolveMummyPendingAttackReward(core)).toMatchObject({
            controllerPlayerId: traitorId,
        });

        activateTestExplorer(core, heroId);
        core.activePlayerId = traitorId;

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL, traitorId, {}),
        )).toMatchObject({ valid: true });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL, heroId, {}),
        )).toMatchObject({ valid: true });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL, traitorId, {});

        expect(core.recentRoll).toMatchObject({
            kind: 'attackRoll',
            requiredPlayerIds: core.playerIds,
            acknowledgedPlayerIds: [traitorId],
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL, traitorId, {}),
        )).toMatchObject({
            valid: false,
            error: '你已经确认过当前投骰结果。',
        });
        for (const playerId of remainingPlayerIds) {
            expect(BetrayalDomain.validate(
                { core, sys: {} as never },
                createBetrayalCommand(BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL, playerId, {}),
            )).toMatchObject({ valid: true });
            core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL, playerId, {});
        }

        expect(core.recentRoll).toBeNull();
        expect(resolveMummyPendingAttackReward(core)).toMatchObject({
            controllerPlayerId: traitorId,
            defenderPlayerId: heroId,
        });
    });

it('木乃伊攻击目标没有可偷对象时不会生成偷取奖励，直接进入强制伤害分配', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const heroId = core.playerIds.find((playerId) => playerId !== traitorId)!;
        const mummyMonsterId = core.scenarioRuntime.mummy!.mummyMonsterId;
        const mummyRoomId = core.monsters.find((monster) => monster.id === mummyMonsterId)!.roomId;
        activateTestExplorer(core, traitorId);
        findTestExplorer(core, heroId).roomId = mummyRoomId;
        setHighCapacityPhysicalDamageTracks(core, heroId);
        setTestExplorerInventory(core, heroId, []);
        core.scenarioRuntime.mummy = {
            ...core.scenarioRuntime.mummy!,
            girlHolderPlayerId: null,
            girlHeldByMummy: false,
        };

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            traitorId,
            { monsterId: mummyMonsterId, targetPlayerId: heroId },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 1, 1, 1, 1, 1),
        );

        expect(resolveMummyStealableCards(core, heroId)).toEqual([]);
        expect(resolveMummyPendingAttackReward(core)).toBeNull();
        expect(core.pendingDamageAllocation).toMatchObject({
            playerId: heroId,
            damageKind: 'physical',
            amount: 4,
            allowSkull: true,
            forcedTraitSequence: ['speed', 'speed', 'speed', 'speed'],
        });
    });

it('木乃伊攻击奖励偷取目标失效时拒绝偷取，但仍可选择造成伤害', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const heroId = core.playerIds.find((playerId) => playerId !== traitorId)!;
        const mummyMonsterId = core.scenarioRuntime.mummy!.mummyMonsterId;
        const mummyRoomId = core.monsters.find((monster) => monster.id === mummyMonsterId)!.roomId;
        activateTestExplorer(core, traitorId);
        findTestExplorer(core, heroId).roomId = mummyRoomId;
        setHighCapacityPhysicalDamageTracks(core, heroId);
        setTestExplorerInventory(core, heroId, [
            { id: 'map', name: '地图', kind: 'item' },
        ]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            traitorId,
            { monsterId: mummyMonsterId, targetPlayerId: heroId },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 1, 1, 1, 1, 1),
        );
        expect(resolveMummyPendingAttackReward(core)).toMatchObject({
            stealableCardIds: ['map'],
        });

        setTestExplorerInventory(core, heroId, []);

        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD, traitorId, {
                choice: 'steal',
                cardId: 'map',
            }),
        )).toMatchObject({
            valid: false,
            error: '该木乃伊奖励目标已经不再可偷。',
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD, traitorId, {
                choice: 'damage',
            }),
        )).toMatchObject({ valid: true });
    });

it('木乃伊选择造成伤害后必须先扣速度，最后一名英雄死亡时按木乃伊横行结算', () => {
        let core = createFirstScenarioHauntCore();
        const traitorId = core.scenarioRuntime.traitorPlayerId!;
        const [targetHeroId, defeatedHeroId] = core.playerIds.filter((playerId) => playerId !== traitorId);
        const mummyMonsterId = core.scenarioRuntime.mummy!.mummyMonsterId;
        const mummyRoomId = core.monsters.find((monster) => monster.id === mummyMonsterId)!.roomId;
        expect(targetHeroId).toBeDefined();
        expect(defeatedHeroId).toBeDefined();
        activateTestExplorer(core, traitorId);
        findTestExplorer(core, targetHeroId!).roomId = mummyRoomId;
        core.scenarioRuntime.deadExplorerPlayerIds = [defeatedHeroId!];
        setTestTraitTrack(core, targetHeroId!, 'speed', [1, 1, 1, 1], 2, 2);
        setTestTraitTrack(core, targetHeroId!, 'might', [1, 1, 1, 1], 2, 2);
        setTestExplorerInventory(core, targetHeroId!, [{ id: 'map', name: '地图', kind: 'item' }]);

        core = applyBetrayalCommand(
            core,
            BETRAYAL_COMMANDS.MONSTER_ATTACK_HERO,
            traitorId,
            { monsterId: mummyMonsterId, targetPlayerId: targetHeroId },
            100,
            createBetrayalScriptedRandom(2, 2, 2, 2, 2, 2, 1, 1, 1),
        );
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_MUMMY_ATTACK_REWARD, traitorId, {
            choice: 'damage',
        });

        expect(core.pendingDamageAllocation).toMatchObject({
            sourceTitle: '木乃伊攻击',
            playerId: targetHeroId,
            damageKind: 'physical',
            allowSkull: true,
            forcedTraitSequence: ['speed', 'speed', 'speed', 'might', 'might', 'might'],
        });
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, targetHeroId!, {
                traits: ['might', 'speed', 'speed', 'speed', 'might', 'might'],
            }),
        )).toMatchObject({
            valid: false,
            error: '木乃伊伤害必须先扣速度，速度降到底后才扣力量。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_DAMAGE_ALLOCATION, targetHeroId!, {
            traits: core.pendingDamageAllocation!.forcedTraitSequence!,
        });

        expect(core.phase).toBe('endgame');
        expect(core.endgameResult).toMatchObject({
            hauntId: 'mummy-rampage',
            hauntTitle: '木乃伊横行',
            outcome: 'traitor',
            traitorPlayerId: traitorId,
        });
    });
});
