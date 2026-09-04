import { describe, expect, it } from 'vitest';
import {
    applyBetrayalCommand,
    createBetrayalCommand,
    createBetrayalScriptedRandom,
    createDogTradeReadyCore,
    createExchangeReadyCore,
    createFirstScenarioHauntCore,
    createStartedFirstScenarioCore,
    createTradeReadyCore,
    BETRAYAL_COMMANDS,
    BetrayalDomain,
    resolveBetrayalTradeCardStatus,
    findTestExplorer,
    acknowledgeRecentRollForAllPlayers,
    activateTestExplorer,
    createMysticElevatorRoomEffectReadyCore,
    setTestExplorerInventory,
    acknowledgeAnyPendingCardResolutions,
    placeActiveTestExplorerInRoom,
    createDustHauntCore,
} from './helpers/firstScenarioRuntimeHarness';
import { resolveBetrayalRoomSpecialActionStatus } from '../roomActionReadModel';

describe('Betrayal first scenario runtime - trade, dog, mask, and elevator', () => {
it('普通交易必须先请求，接收方同意后才转移持有物', () => {
        let core = createTradeReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            cardId: 'rope',
        });

        expect(core.pendingTradeAgreement).toMatchObject({
            playerId: '0',
            targetPlayerId: '1',
            cardIds: ['rope'],
        });
        expect(core.activePlayerId).toBe('1');
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['medical-kit', 'rope', 'omen-book']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['map', 'skull']);
        expect(core.activityLog[0]?.text).toContain('同意');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
        });

        expect(core.pendingTradeAgreement).toBeNull();
        expect(core.activePlayerId).toBeNull();
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['medical-kit', 'omen-book']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['map', 'skull', 'rope']);
        expect(core.tradeUsedThisTurnPlayerIds).toContain('0');
        expect(core.activityLog[0]?.text).toContain('同意交易');

        const secondTradeSameTurn = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                targetPlayerId: '1',
                cardId: 'omen-book',
            }),
        );

        expect(secondTradeSameTurn.valid).toBe(false);
        if (!secondTradeSameTurn.valid) {
            expect(secondTradeSameTurn.error).toContain('本回合已经完成过交易');
        }

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.tradeUsedThisTurnPlayerIds).toEqual([]);
        expect(core.currentPlayer).toBe('1');

        const nextPlayerTrade = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '1', {
                targetPlayerId: '0',
                cardId: 'rope',
            }),
        );
        expect(nextPlayerTrade.valid).toBe(true);
    });

it('移动不会消耗本回合普通交易额度', () => {
        let core = createTradeReadyCore();
        core.otherExplorers = core.otherExplorers.map((explorer) => (
            explorer.playerId === '1'
                ? {
                    ...explorer,
                    roomId: 'grand-staircase',
                }
                : explorer
        ));

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.MOVE_TO_ROOM, '0', {
            roomId: 'grand-staircase',
        });

        expect(core.currentExplorer.roomId).toBe('grand-staircase');
        expect(core.tradeUsedThisTurnPlayerIds).toEqual([]);

        const tradeAfterMove = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                targetPlayerId: '1',
                cardId: 'rope',
            }),
        );

        expect(tradeAfterMove.valid).toBe(true);
    });

it('普通交易被接收方拒绝后不会转移持有物', () => {
        let core = createTradeReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            cardId: 'rope',
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: false,
        });

        expect(core.pendingTradeAgreement).toBeNull();
        expect(core.activePlayerId).toBeNull();
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['medical-kit', 'rope', 'omen-book']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['map', 'skull']);
        expect(core.activityLog[0]?.text).toContain('拒绝');
    });

it('同房间交易支持双方交换持有物，且拒绝时双方都不转移', () => {
        let core = createExchangeReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            cardId: 'rope',
            targetCardIds: ['map'],
        });

        expect(core.pendingTradeAgreement).toMatchObject({
            playerId: '0',
            targetPlayerId: '1',
            cardIds: ['rope'],
            targetCardIds: ['map'],
        });
        expect(core.activePlayerId).toBe('1');
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['medical-kit', 'rope', 'omen-book']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['map', 'skull']);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: false,
        });

        expect(core.pendingTradeAgreement).toBeNull();
        expect(core.activePlayerId).toBeNull();
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['medical-kit', 'rope', 'omen-book']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['map', 'skull']);
        expect(core.activityLog[0]?.text).toContain('拒绝');
    });

it('同房间交易在接收方同意后会双向交换持有物', () => {
        let core = createExchangeReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            cardId: 'rope',
            targetCardIds: ['map'],
        });
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
        });

        expect(core.pendingTradeAgreement).toBeNull();
        expect(core.activePlayerId).toBeNull();
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['medical-kit', 'omen-book', 'map']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope']);
        expect(core.receivedCardIdsThisTurnByPlayerId['0']).toContain('map');
        expect(core.receivedCardIdsThisTurnByPlayerId['1']).toContain('rope');
        expect(core.activityLog[0]?.text).toContain('给出兔脚');
        expect(core.activityLog[0]?.text).toContain('给出地图');
        expect(core.activityLog[0]?.text).not.toContain('换回');
    });

it('同房间交易允许发起方一次给出任意多张持有物，接收方同意后才结算', () => {
        let core = createExchangeReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            cardIds: ['rope', 'omen-book'],
            targetCardIds: ['map'],
        });

        expect(core.pendingTradeAgreement).toMatchObject({
            playerId: '0',
            targetPlayerId: '1',
            cardIds: ['rope', 'omen-book'],
            targetCardIds: ['map'],
        });
        expect(core.activePlayerId).toBe('1');
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['medical-kit', 'rope', 'omen-book']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['map', 'skull']);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
        });

        expect(core.pendingTradeAgreement).toBeNull();
        expect(core.activePlayerId).toBeNull();
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['medical-kit', 'map']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull', 'rope', 'omen-book']);
        expect(core.receivedCardIdsThisTurnByPlayerId['0']).toContain('map');
        expect(core.receivedCardIdsThisTurnByPlayerId['1']).toEqual(expect.arrayContaining(['rope', 'omen-book']));
        expect(core.activityLog[0]?.text).toContain('给出兔脚、书本');
        expect(core.activityLog[0]?.text).toContain('给出地图');
    });

it('同房间交易允许只拿对方持有物，接收方同意后才结算', () => {
        let core = createExchangeReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            targetPlayerId: '1',
            targetCardIds: ['map'],
        });

        expect(core.pendingTradeAgreement).toMatchObject({
            playerId: '0',
            targetPlayerId: '1',
            cardIds: [],
            targetCardIds: ['map'],
        });
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['medical-kit', 'rope', 'omen-book']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['map', 'skull']);

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
        });

        expect(core.pendingTradeAgreement).toBeNull();
        expect(core.activePlayerId).toBeNull();
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['medical-kit', 'rope', 'omen-book', 'map']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['skull']);
        expect(core.receivedCardIdsThisTurnByPlayerId['0']).toContain('map');
        expect(core.activityLog[0]?.text).toContain('给出地图');
        expect(core.activityLog[0]?.text).not.toContain('索要');
    });

it('同房间交易不允许双方都不选择持有物', () => {
        const core = createExchangeReadyCore();

        const emptyTrade = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
                targetPlayerId: '1',
                cardIds: [],
                targetCardIds: [],
            }),
        );

        expect(emptyTrade.valid).toBe(false);
        if (!emptyTrade.valid) {
            expect(emptyTrade.error).toContain('缺少交易对象或持有物');
        }
    });

it('狗每回合一次，可请求与 4 格内玩家交易任意数量物品或预兆，同意后才结算', () => {
        let core = createDogTradeReadyCore();

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.TRADE_POSSESSION, '0', {
            useDog: true,
            targetPlayerId: '1',
            cardIds: ['medical-kit', 'map'],
        });

        expect(core.pendingTradeAgreement).toMatchObject({
            playerId: '0',
            targetPlayerId: '1',
            cardIds: ['medical-kit', 'map'],
            useDog: true,
            sourceCardId: 'dog',
        });
        expect(core.activePlayerId).toBe('1');
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['dog', 'medical-kit', 'map']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual([]);
        expect(core.usedCardIdsThisTurn).not.toContain('dog');
        expect(core.activityLog[0]?.text).toContain('同意');

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
        });

        expect(core.pendingTradeAgreement).toBeNull();
        expect(core.activePlayerId).toBeNull();
        expect(findTestExplorer(core, '0').inventory.map((card) => card.id)).toEqual(['dog']);
        expect(findTestExplorer(core, '1').inventory.map((card) => card.id)).toEqual(['medical-kit', 'map']);
        expect(core.usedCardIdsThisTurn).toContain('dog');
        expect(core.activityLog[0]?.text).toContain('同意交易');
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

it('交易卡状态区分可交易、已用、狗来源和不存在持有物', () => {
        const core = createDogTradeReadyCore();
        core.usedCardIdsThisTurn = ['medical-kit'];

        expect(resolveBetrayalTradeCardStatus(core, 'map')).toMatchObject({
            sourceKind: 'trade',
            ownerRole: 'requester',
            exists: true,
            canTrade: true,
            reason: null,
        });
        expect(resolveBetrayalTradeCardStatus(core, 'medical-kit')).toMatchObject({
            exists: true,
            canTrade: false,
            usedThisTurn: true,
            reason: '本回合已经使用过的持有物不能交易。',
        });
        expect(resolveBetrayalTradeCardStatus(core, 'dog', { useDogTrade: true })).toMatchObject({
            exists: true,
            canTrade: false,
            reservedAsTradeSource: true,
            reason: '本回合已经使用过的持有物不能交易。',
        });
        expect(resolveBetrayalTradeCardStatus(core, 'missing-card')).toMatchObject({
            exists: false,
            canTrade: false,
            reason: '当前探索者没有这件持有物。',
        });
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
        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT, '1', {
            accept: true,
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

it.each([
        ['medical-kit', '急救包', 'item'],
        ['mirror', '镜子', 'item'],
        ['holy-water', '奇怪的药品', 'item'],
        ['map', '地图', 'item'],
        ['notebook', '笔记本', 'item'],
        ['manuscript', '手稿', 'item'],
        ['omen-book', '书本', 'omen'],
        ['mask', '面具', 'omen'],
        ['journal', '日记', 'item'],
    ] as const)('灰尘阶段主动持有牌「%s」已用后不能通过普通交易或狗交易转移', (cardId, cardName, kind) => {
        const normalTradeCore = createDustHauntCore(['0', '1', '2']);
        activateTestExplorer(normalTradeCore, '1');
        placeActiveTestExplorerInRoom(normalTradeCore, '1', 'hallway');
        setTestExplorerInventory(normalTradeCore, '1', [{ id: cardId, name: cardName, kind }]);
        normalTradeCore.otherExplorers = normalTradeCore.otherExplorers.map((explorer) => (
            explorer.playerId === '2'
                ? { ...explorer, roomId: 'hallway', inventory: [] }
                : explorer
        ));
        normalTradeCore.turnStartInventoryCardIds = [cardId];
        normalTradeCore.usedCardIdsThisTurn = [cardId];

        const normalTrade = BetrayalDomain.validate(
            { core: normalTradeCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '1', {
                targetPlayerId: '2',
                cardIds: [cardId],
            }),
        );

        expect(normalTrade.valid).toBe(false);
        if (!normalTrade.valid) {
            expect(normalTrade.error).toContain('本回合已经使用过的持有物不能交易');
        }

        const dogTradeCore = createDustHauntCore(['0', '1', '2']);
        activateTestExplorer(dogTradeCore, '1');
        placeActiveTestExplorerInRoom(dogTradeCore, '1', 'entrance-hall');
        setTestExplorerInventory(dogTradeCore, '1', [
            { id: 'dog', name: '狗', kind: 'omen' },
            { id: cardId, name: cardName, kind },
        ]);
        dogTradeCore.otherExplorers = dogTradeCore.otherExplorers.map((explorer) => (
            explorer.playerId === '2'
                ? { ...explorer, roomId: 'upper-landing', inventory: [] }
                : explorer
        ));
        dogTradeCore.turnStartInventoryCardIds = ['dog', cardId];
        dogTradeCore.usedCardIdsThisTurn = [cardId];

        const dogTrade = BetrayalDomain.validate(
            { core: dogTradeCore, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.TRADE_POSSESSION, '1', {
                useDog: true,
                targetPlayerId: '2',
                cardIds: [cardId],
            }),
        );

        expect(dogTrade.valid).toBe(false);
        if (!dogTrade.valid) {
            expect(dogTrade.error).toContain('本回合已经使用过的持有物不能交易');
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
            tokenAsset: 'betrayal/tokens/monsters/jacks-spirit',
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
            tokenAsset: 'betrayal/tokens/monsters/jacks-spirit',
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

        expect(resolveBetrayalRoomSpecialActionStatus(core)).toMatchObject({
            sourceKind: 'roomEffect',
            active: false,
            canUse: false,
            reason: '当前房间没有可使用的房间效果。',
        });

        core = createMysticElevatorRoomEffectReadyCore();
        core.turnEndedByDiscovery = true;
        expect(resolveBetrayalRoomSpecialActionStatus(core)).toMatchObject({
            sourceKind: 'roomEffect',
            sourceId: 'mysticElevator',
            sourceName: '神秘电梯',
            active: true,
            canUse: false,
            usedThisTurn: false,
            turnEndedByDiscovery: true,
            reason: '探索新房间后本回合已结束。',
        });
        core.turnEndedByDiscovery = false;
        core.movesRemaining = 2;
        expect(core.rooms.find((room) => room.id === 'upper-north')?.name).toBe('神秘电梯');
        core = acknowledgeAnyPendingCardResolutions(core);
        expect(resolveBetrayalRoomSpecialActionStatus(core)).toMatchObject({
            sourceId: 'mysticElevator',
            canUse: true,
            reason: null,
        });

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
        expect(core.recentRoll?.kind).toBe('mysticElevator');
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.ACKNOWLEDGE_RECENT_ROLL, '0', {}),
        ).valid).toBe(true);
        expect(BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.ACKNOWLEDGE_TURN_END_ROLL, '0', {}),
        ).valid).toBe(false);

        core = acknowledgeRecentRollForAllPlayers(core);
        expect(core.recentRoll).toBeNull();

        const secondUse = BetrayalDomain.validate(
            { core, sys: {} as never },
            createBetrayalCommand(BETRAYAL_COMMANDS.USE_ROOM_EFFECT, '0', {}),
        );
        expect(secondUse).toMatchObject({
            valid: false,
            error: '该房间效果本回合已经使用。',
        });
        expect(resolveBetrayalRoomSpecialActionStatus(core)).toMatchObject({
            sourceId: 'mysticElevator',
            canUse: false,
            usedThisTurn: true,
            reason: '该房间效果本回合已经使用。',
        });

        core = applyBetrayalCommand(core, BETRAYAL_COMMANDS.END_TURN, '0', {});
        expect(core.scenarioRuntime.usedRoomEffectIdsThisTurn).toEqual([]);
    });

it('兔脚可以重掷神秘电梯刚投过的一颗骰子并重算楼层', () => {
        let core = createMysticElevatorRoomEffectReadyCore();
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
        core = acknowledgeAnyPendingCardResolutions(core);

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
});
