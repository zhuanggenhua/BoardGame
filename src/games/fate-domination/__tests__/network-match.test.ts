// @vitest-environment node
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {Server} from 'socket.io';
import msgpackParser from 'socket.io-msgpack-parser';
import {expect, it} from 'vitest';
import {GameTransportServer} from '../../../engine/transport/server';
import {GameTransportClient} from '../../../engine/transport/client';
import {InMemoryStorage} from '../../../engine/transport/__tests__/helpers/serverTestHarness';
import type {MatchState} from '../../../engine/types';
import {FateDominationDomain} from '../domain';
import type {FateDominationCommand, FateDominationCore} from '../domain';
import {engineConfig} from '../game';
import {FATE_ATTACK_BY_ID, FATE_MASTERS, FATE_SERVANTS} from '../data';
import {createFateAttackDeck} from '../domain/setup';

type State = MatchState<FateDominationCore>;
const ids = ['0', '1', '2'];

it('真实网络保留明确选择的同值部署点位，并拒绝已占用点位',async()=>{
    await withNetworkMatch(async match=>{
        for(const id of ids)await match.send(id,'ADVANCE_PHASE');
        await match.send('0','DEPLOY_MASTER',{locationId:'workshop',deploymentSlot:0});
        await match.send('0','ADVANCE_PHASE');
        const before=(await match.state()).core.players['1'].mana;
        const deployed=await match.send('1','DEPLOY_MASTER',{locationId:'workshop',deploymentSlot:3});
        expect(deployed.core.players['1'].deploymentSlot).toBe(3);
        expect(deployed.core.players['1'].mana-before).toBe(1);
        await match.send('1','ADVANCE_PHASE');
        const snapshot=(await match.state()).core;
        expect(match.clients[2].sendCommand('DEPLOY_MASTER',{locationId:'workshop',deploymentSlot:3})).toBe(true);
        await expect.poll(()=>match.errors[2].length).toBeGreaterThan(0);
        expect((await match.state()).core).toEqual(snapshot);
        const accepted=await match.send('2','DEPLOY_MASTER',{locationId:'workshop',deploymentSlot:2});
        expect(accepted.core.players['2'].deploymentSlot).toBe(2);
    });
});

/** 真实环回网络与正式客户端；此层验证协议，不声称覆盖浏览器操作或素材。 */
async function withNetworkMatch(run: (match: {
    clients: GameTransportClient[];
    errors: string[][];
    state: () => Promise<State>;
    send: (playerId: string, type: FateDominationCommand['type'] | 'SYS_INTERACTION_RESPOND', payload?: object) => Promise<State>;
}) => Promise<void>, seed = 'eleven-natural-rounds', prepare?: (state: State) => void) {
    const http = createServer();
    const io = new Server(http, {parser: msgpackParser});
    const storage = new InMemoryStorage();
    const server = new GameTransportServer({io, storage, games: [engineConfig], onlineAiRecoveryTickMs: 0,
        authenticate: async (_match, playerId, credential, metadata) => metadata.players[playerId]?.credentials === credential,
    });
    const matchId = 'fate-network-acceptance';
    const initial = await server.setupMatch(matchId, 'fate-domination', ids, seed);
    expect(initial).not.toBeNull();
    prepare?.(initial!.state as State);
    await storage.createMatch(matchId, {
        initialState: {G: initial!.state, _stateID: 0, randomSeed: seed, randomCursor: initial!.randomCursor},
        metadata: {gameName: 'fate-domination', createdAt: 1, updatedAt: 1,
            players: Object.fromEntries(ids.map(id => [id, {name: `玩家${id}`, credentials: `test-only-${id}`}]))},
    });
    server.start();
    await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
    const errors: string[][] = ids.map(() => []);
    const clients = ids.map((id, index) => new GameTransportClient({
        server: `http://127.0.0.1:${(http.address() as AddressInfo).port}`, matchID: matchId,
        playerID: id, credentials: `test-only-${id}`, onError: error => errors[index].push(error),
    }));
    const state = async () => (await storage.fetch(matchId, {state: true})).state!.G as State;
    try {
        clients.forEach(client => client.connect());
        await expect.poll(() => clients.every(client => client.isConnected && client.latestState), {timeout: 15000}).toBe(true);
        const send = async (playerId: string, type: FateDominationCommand['type'] | 'SYS_INTERACTION_RESPOND', payload: object = {}) => {
            const before = (await storage.fetch(matchId, {state: true})).state!._stateID;
            expect(clients[Number(playerId)].sendCommand(type, payload)).toBe(true);
            await expect.poll(async () => (await storage.fetch(matchId, {state: true})).state!._stateID, {timeout: 10000}).toBe(before + 1);
            await expect.poll(() => clients.every(client => client.lastReceivedStateID === before + 1), {timeout: 10000}).toBe(true);
            return state();
        };
        await run({clients, errors, state, send});
    } finally {
        clients.forEach(client => client.disconnect());
        await new Promise<void>(resolve => io.close(() => resolve()));
    }
}

it('真实三客户端网络自然推进十一轮，私有手牌裁剪与权威终局一致（协议层，非浏览器黄金链）', async () => {
    await withNetworkMatch(async ({clients, errors, state, send}) => {
        let commands = 0;
        const phases = new Set<string>();
        const rounds = new Set<number>();
        while (!(await state()).sys.gameover && commands < 400) {
            const authoritative = await state();
            const {core} = authoritative;
            const playerId = core.currentPlayerId;
            const player = core.players[playerId];
            phases.add(core.phase); rounds.add(core.round);
            let type: FateDominationCommand['type'];
            let payload: object = {};
            if (core.phase === 'preparation') type = 'ADVANCE_PHASE';
            else if (core.phase === 'outpost') {
                type = player.locationId ? 'ADVANCE_PHASE' : 'DEPLOY_MASTER';
                if (type === 'DEPLOY_MASTER') payload = {locationId: 'miyama'};
            } else if (core.phase === 'action') {
                type = 'PASS_ACTION';
                if (!player.normalAttackPlayed) {
                    findPair: for (let a = 0; a < player.hand.length; a++) for (let b = a + 1; b < player.hand.length; b++) for (const mask of [0, 1, 2, 3]) {
                        const cardIds = [player.hand[a].id, player.hand[b].id];
                        const candidate = {cardIds, faceDownIds: cardIds.filter((_, i) => Boolean(mask & (1 << i))), round: core.round};
                        if (FateDominationDomain.validate(authoritative, {type: 'CONFIRM_ATTACK', playerId, payload: candidate}).valid) {
                            type = 'CONFIRM_ATTACK'; payload = candidate; break findPair;
                        }
                    }
                }
            } else if (core.battleResolution?.step === 'locations') {
                type = 'RESOLVE_LOCATION'; payload = {locationId: core.battleResolution.locationIds.find(id => !core.resolvedLocations.includes(id))};
            } else type = 'ADVANCE_PHASE';
            const after = await send(playerId, type, payload); commands++;
            for (const [viewer, client] of clients.entries()) {
                const view = client.latestState as State;
                for (const id of ids.filter(id => id !== String(viewer))) {
                    expect(view.core.players[id].hand).toEqual([]);
                    expect(view.core.players[id].deck).toEqual([]);
                }
                expect(view.core.round).toBe(after.core.round);
                expect(view.core.phase).toBe(after.core.phase);
            }
        }
        const final = await state();
        expect([...phases].sort()).toEqual(['action', 'battle', 'outpost', 'preparation']);
        expect(rounds.size).toBe(11);
        expect(commands).toBeGreaterThan(150);
        expect(final.core.phase).toBe('complete');
        expect(final.sys.gameover).toEqual(final.core.gameResult);
        for (const client of clients) expect((client.latestState as State).sys.gameover).toEqual(final.sys.gameover);
        expect(errors).toEqual([[], [], []]);
    });
}, 60000);

it('真实网络拒绝越权、过期、重复确认；暗置实例不泄露，重连恢复同一权威状态', async () => {
    await withNetworkMatch(async ({clients, errors, state, send}) => {
        for (const id of ids) await send(id, 'ADVANCE_PHASE');
        for (const id of ids) {await send(id, 'DEPLOY_MASTER', {locationId: 'workshop'}); await send(id, 'ADVANCE_PHASE');}
        const before = await state();
        const cards = before.core.players['0'].hand.slice(0, 2).map(card => card.id);
        const payload = {cardIds: cards, faceDownIds: cards, round: before.core.round};
        const reject = async (id: number, invalid: object) => {
            const errorCount = errors[id].length;
            const version = clients[id].lastReceivedStateID;
            expect(clients[id].sendCommand('CONFIRM_ATTACK', invalid)).toBe(true);
            await expect.poll(() => errors[id].length, {timeout: 10000}).toBeGreaterThan(errorCount);
            expect(clients[id].lastReceivedStateID).toBe(version);
        };
        await reject(1, payload);
        await reject(0, {...payload, round: before.core.round + 1});
        await reject(0, {...payload, cardIds: [cards[0], cards[0]]});
        expect((await state()).core.players['0'].normalAttackPlayed).toBe(false);
        expect((await state()).core.players['0'].mana).toBe(before.core.players['0'].mana);
        const accepted = await send('0', 'CONFIRM_ATTACK', payload);
        expect(accepted.core.players['0'].activeAttackIds).toEqual(cards);
        expect(accepted.core.players['0'].mana).toBe(before.core.players['0'].mana);
        for (const client of clients.slice(1)) {
            const view = client.latestState as State;
            for (const cardId of cards) expect(JSON.stringify(view)).not.toContain(cardId);
            expect(view.core.players['0'].publicView?.playedCards).toHaveLength(2);
        }
        await reject(0, payload);
        const previousVersion = clients[0].lastReceivedStateID;
        clients[0].getSocket()!.disconnect();
        expect(clients[0].sendCommand('CONFIRM_ATTACK', payload)).toBe(false);
        clients[0].getSocket()!.connect();
        await expect.poll(() => clients[0].isConnected && clients[0].lastReceivedStateID === previousVersion, {timeout: 10000}).toBe(true);
        expect((clients[0].latestState as State).core.players['0'].activeAttackIds).toEqual(cards);
        expect((await state()).core.players['0'].mana).toBe(accepted.core.players['0'].mana);
    });
}, 30000);

it('真实网络骑乘与常规两张出牌隔离，拒绝第四张并确认三张零费牌', async () => {
    await withNetworkMatch(async ({clients, errors, state, send}) => {
        await send('0', 'SELECT_MASTER', {masterId: 'm_waver'});
        await send('0', 'SELECT_SERVANT', {servantId: 'servant-rider'});
        for (const id of ids) await send(id, 'ADVANCE_PHASE');
        for (const id of ids) {
            await send(id, 'DEPLOY_MASTER', {locationId: 'workshop'});
            if (id === '0') await send('0', 'PLAY_SKILL', {skillId: (await state()).core.players['0'].skills.find(skill => skill.isMasterSkill && skill.name === '战略部署')!.id});
            await send(id, 'ADVANCE_PHASE');
        }
        await send('0', 'USE_COMMAND_SPELL', {effect: 'mana'});
        const before = await state();
        const actor = before.core.players['0'];
        const ridingId = actor.skills.find(skill => skill.id.startsWith('sc_iskandar_1'))!.id;
        const attackId = [...actor.hand].sort((a, b) => FATE_ATTACK_BY_ID[b.definitionId].basePower - FATE_ATTACK_BY_ID[a.definitionId].basePower).find(card => FateDominationDomain.validate(before, {
            type: 'CONFIRM_ATTACK', playerId: '0', payload: {cardIds: [card.id, ridingId], faceDownIds: [], round: before.core.round},
        }).valid)!.id;
        await send('0', 'CONFIRM_ATTACK', {cardIds: [attackId, ridingId], faceDownIds: [], round: before.core.round});
        await send('0', 'PLAY_SKILL', {skillId: ridingId});
        const open = await state();
        const choice = open.sys.interaction.current!;
        const data = choice.data as {options: Array<{id: string}>};
        const player = open.core.players['0'];
        const candidates = data.options.map(option => option.id).sort((a, b) =>
            FATE_ATTACK_BY_ID[player.hand.find(card => card.id === a)!.definitionId].manaCost
            - FATE_ATTACK_BY_ID[player.hand.find(card => card.id === b)!.definitionId].manaCost);
        expect(candidates.length, JSON.stringify({hand: player.hand, candidates})).toBeGreaterThanOrEqual(4);
        for (const client of clients.slice(1)) for (const id of candidates) expect(JSON.stringify(client.latestState)).not.toContain(id);
        const reject = async (viewer: number, optionIds: string[]) => {
            const count = errors[viewer].length;
            const version = clients[viewer].lastReceivedStateID;
            expect(clients[viewer].sendCommand('SYS_INTERACTION_RESPOND', {interactionId: choice.id, optionIds})).toBe(true);
            await expect.poll(() => errors[viewer].length).toBeGreaterThan(count);
            expect(clients[viewer].lastReceivedStateID).toBe(version);
        };
        await reject(1, candidates.slice(0, 1));
        await reject(0, candidates.slice(0, 4));
        expect((await state()).core.players['0'].mana).toBe(player.mana);
        const selected = candidates.slice(0, 3);
        const cost = selected.reduce((sum, id) => sum + FATE_ATTACK_BY_ID[player.hand.find(card => card.id === id)!.definitionId].manaCost, 0);
        expect(cost).toBe(0);
        expect(cost).toBeLessThanOrEqual(player.mana);
        const accepted = await send('0', 'SYS_INTERACTION_RESPOND', {interactionId: choice.id, optionIds: selected});
        expect(accepted.core.players['0'].mana).toBe(player.mana - cost);
        expect(accepted.core.players['0'].activeAttackIds).toEqual([attackId, ...selected]);
        expect(accepted.core.players['0'].selectedAttackIds).toEqual([]);
        expect(accepted.core.players['0'].normalAttackPlayed).toBe(true);
        expect(accepted.sys.interaction.current).toBeUndefined();
        await reject(0, selected);
    });
}, 30000);

it('真实网络正费用骑乘扣款（合法原牌实例代表态，非自然抽牌链）', async () => {
    await withNetworkMatch(async ({state, send}) => {
        const before = await state();
        const actor = before.core.players['0'];
        const skillId = actor.activeSkills[0];
        const paid = actor.hand.find(card => card.definitionId === 'cardSurveil')!;
        const cost = FATE_ATTACK_BY_ID[paid.definitionId].manaCost;
        expect(cost).toBeGreaterThan(0);
        await send('0', 'PLAY_SKILL', {skillId});
        const choice = (await state()).sys.interaction.current!;
        expect((choice.data as {options: Array<{id: string}>}).options.some(option => option.id === paid.id)).toBe(true);
        const accepted = await send('0', 'SYS_INTERACTION_RESPOND', {interactionId: choice.id, optionIds: [paid.id]});
        expect(accepted.core.players['0'].mana).toBe(actor.mana - cost);
        expect(accepted.core.players['0'].activeAttackIds).toEqual([...actor.activeAttackIds, paid.id]);
        expect(accepted.core.players['0'].selectedAttackIds).toEqual([]);
        expect(accepted.core.players['0'].normalAttackPlayed).toBe(true);
        expect(accepted.sys.interaction.current).toBeUndefined();
    }, 'riding-positive-cost-fixture', initial => {
        const master = FATE_MASTERS.find(item => item.id === 'm_waver')!;
        const servant = FATE_SERVANTS.find(item => item.id === 'servant-rider')!;
        const deck = createFateAttackDeck('0', servant.id);
        const skills = [...(master.skills ?? []), ...(servant.skillCards ?? [])].map((skill, index) => ({...skill, id: `${skill.id ?? skill.name}:${index}`}));
        const active = deck.find(card => card.definitionId === 'cardB4')!;
        const paid = deck.find(card => card.definitionId === 'cardSurveil')!;
        expect(active).toBeTruthy(); expect(paid).toBeTruthy();
        // 只在连接前定义合法牌区起点，保留正式牌组全部实例与唯一 ID。
        initial.core.phase = 'action';
        initial.core.currentPlayerId = '0';
        initial.core.players['0'] = {...initial.core.players['0'], masterId: master.id, servantId: servant.id,
            skills, locationId: 'workshop', deploymentSlot: 0, mana: 6,
            hand: [active, paid], deck: deck.filter(card => card.id !== active.id && card.id !== paid.id),
            activeSkills: [skills.find(skill => skill.id.startsWith('sc_iskandar_1'))!.id], activeAttackIds: [active.id],
            selectedAttackIds: [], selectedFaceDownIds: [], normalAttackPlayed: true, usedAbilityIds: [],
        };
        initial.core.battlefield.workshop.playerIds = ['0'];
        const allIds = [...initial.core.players['0'].hand, ...initial.core.players['0'].deck].map(card => card.id);
        expect(new Set(allIds).size).toBe(deck.length);
    });
}, 30000);
