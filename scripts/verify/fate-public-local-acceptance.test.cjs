// Pure collector contract checks; this file does not launch a browser or produce E2E evidence.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.FATE_ENTRY = '/assets/test-only.js';
process.env.FATE_ENTRY_SHA256 = '0'.repeat(64);
process.env.FATE_SOURCE_REVISION = 'contract-test-only';
process.env.FATE_EXPECTED_PLAYERS = '3';
const { readPersistedSnapshot, validateSample, compactState, pendingInputChecks, nextPrimaryExpectation } = require('./fate-public-local-acceptance.cjs');

const target = 'https://example.test/play/fate-domination/local?players=3&seed=exact-run';
let persisted;
let keys;
beforeEach(() => {
    keys = [];
    persisted = {
        version: 1, gameId: 'fate-domination', seed: 'exact-run', numPlayers: 3, savedAt: 10, randomCursor: 4,
        state: { core: { gameId: 'fate-domination', round: 1, phase: 'preparation', currentPlayerId: '0', players: {} }, sys: {} },
    };
    global.location = { href: target };
    global.localStorage = {
        getItem: key => { keys.push(key); return JSON.stringify(persisted); },
        setItem: () => { throw new Error('Collector must never mutate storage'); },
    };
    global.document = { body: { innerText: '准备' }, querySelector: () => null, querySelectorAll: () => [] };
});

test('reads only the precise original match and returns the persisted authority, without writes', () => {
    const sample = readPersistedSnapshot(target);
    assert.equal(validateSample(sample).snapshot.randomCursor, 4);
    assert.deepEqual(keys, ['local_match_snapshot_v1:fate-domination:exact-run']);
    assert.equal(sample.visible.gameOver, false);
});

test('rejects another seed, origin, route or fixed viewer instead of accepting another match', () => {
    for (const url of [
        target.replace('exact-run', 'another-run'),
        target.replace('example.test', 'another.test'),
        target.replace('/local?', '/another?'),
        target + '&playerID=1',
    ]) {
        global.location.href = url;
        assert.throws(() => readPersistedSnapshot(target), /original match identity/);
    }
    assert.equal(keys.length, 0);
});

test('missing or mismatched snapshot cannot become valid evidence', () => {
    persisted.seed = 'stale';
    assert.equal(readPersistedSnapshot(target), null);
    assert.throws(() => validateSample(null), /authoritative persisted state missing/);
    persisted.seed = 'exact-run';
    persisted.numPlayers = 7;
    assert.throws(() => validateSample(readPersistedSnapshot(target)), /authoritative persisted state missing/);
});

test('compact observation retains authoritative terminal and resource facts', () => {
    const result = { winner: '0', scores: { '0': 12 } };
    const compact = compactState({
        core: { gameId: 'fate-domination', round: 11, phase: 'complete', gameResult: result, players: { '0': { mana: 2, commandSpells: 1, hand: [] } } },
        sys: { gameover: result, interaction: { current: null } },
    });
    assert.equal(compact.gameOver, true);
    assert.deepEqual(compact.gameResult, compact.systemGameResult);
    assert.equal(compact.players['0'].commandSpells, 1);
});

test('next real input cannot outrun the previous visible and authoritative checks; inspection and abort remain available', () => {
    const step = { id: 'step-0001', assertions: [] };
    for (const command of ['NEXT', 'CLICKTEXT 部署', 'CLICKEXACT 结束我的前哨阶段', 'CLICK 1 2 target', 'SELECT {}', 'PRESS Enter', 'MOVE 1 2 target', 'DRAG 1 2 3 4 target', 'WHEEL 1 2 3 target', 'RELOAD']) {
        assert.deepEqual(pendingInputChecks(command, step), ['visible', 'authoritative']);
    }
    for (const command of ['DUMP', 'CHECK {}', 'SNAP {}', 'ABORT 保留失败诊断', 'FULLSTATE']) {
        assert.deepEqual(pendingInputChecks(command, step), []);
    }
    step.assertions.push({ path: ['before', 'visible', 'phase'], actual: '准备', expected: '准备' });
    assert.deepEqual(pendingInputChecks('PRESS Enter', step), ['visible', 'authoritative']);
    step.assertions.push({ path: ['after', 'visible', 'phase'], actual: '准备', expected: '准备' });
    assert.deepEqual(pendingInputChecks('PRESS Enter', step), ['authoritative']);
    step.assertions.push({ path: ['after', 'authoritative', 'phase'], actual: 'preparation', expected: 'preparation' });
    assert.deepEqual(pendingInputChecks('PRESS Enter', step), []);
    assert.deepEqual(pendingInputChecks('PRESS Enter', undefined), []);
});

test('primary advance expectations use the actual rotated order, not player numbering', () => {
    const state = { phase: 'outpost', currentPlayerId: '2', turnOrder: ['2','0','1'], phaseCompletedPlayerIds: [], players: {
        '0': { eliminated:false }, '1': { eliminated:false }, '2': { eliminated:false },
    }};
    assert.deepEqual(nextPrimaryExpectation(state), {phase:'outpost',currentPlayerId:'0'});
    state.currentPlayerId='0';state.phaseCompletedPlayerIds=['2'];
    assert.deepEqual(nextPrimaryExpectation(state), {phase:'outpost',currentPlayerId:'1'});
    state.currentPlayerId='1';state.phaseCompletedPlayerIds=['2','0'];
    assert.deepEqual(nextPrimaryExpectation(state), {phase:'action',currentPlayerId:'2'});
    state.phase='preparation';
    assert.deepEqual(nextPrimaryExpectation(state), {phase:'outpost',currentPlayerId:'2'});
    state.phase='battle';
    assert.deepEqual(nextPrimaryExpectation(state), {phase:'battle',currentPlayerId:'1',resolutionStep:'locations'});
    state.battleResolution={step:'locations'};
    assert.equal(nextPrimaryExpectation(state), null, 'settlement must not be guessed by this narrow helper');
});

test('primary expectations separate confirming attacks from passing and skip eliminated players', () => {
    const state={phase:'action',currentPlayerId:'0',turnOrder:['2','0','1'],phaseCompletedPlayerIds:[],players:{
        '2':{eliminated:false,locationId:'miyama',hasPassedAction:true},
        '0':{eliminated:false,locationId:'miyama',hasPassedAction:false,selectedAttackIds:[],handIds:['a','b'],activeAttackIds:[],activeSkills:[]},
        '1':{eliminated:false,locationId:'miyama',hasPassedAction:false},
    }};
    assert.deepEqual(nextPrimaryExpectation(state), {phase:'action',currentPlayerId:'1',playerChanges:{hasPassedAction:true}});
    state.players['1'].eliminated=true;
    assert.deepEqual(nextPrimaryExpectation(state), {phase:'battle',currentPlayerId:'2',playerChanges:{hasPassedAction:true}});
    state.players['0'].selectedAttackIds=['a','skill'];
    assert.deepEqual(nextPrimaryExpectation(state), {phase:'action',currentPlayerId:'0',playerChanges:{
        selectedAttackIds:[],selectedFaceDownIds:[],normalAttackPlayed:true,activeAttackIds:['a'],activeSkills:['skill'],
    }});
    state.players['0'].selectedAttackIds=['a'];
    assert.equal(nextPrimaryExpectation(state),null);
});

test('NEXT refuses movement or other primary-button overrides before any click', () => {
    const state={phase:'action',currentPlayerId:'0',turnOrder:['0','1'],phaseCompletedPlayerIds:[],players:{
        '0':{locationId:'miyama',selectedAttackIds:[],handIds:[],activeAttackIds:[],activeSkills:[]},
        '1':{locationId:'miyama',hasPassedAction:false},
    }};
    assert.equal(nextPrimaryExpectation(state,'确认移动'),null);
    assert.equal(nextPrimaryExpectation(state,'选择两张攻击'),null);
    assert.equal(nextPrimaryExpectation(state,'结束行动').currentPlayerId,'1');
    state.players['0'].selectedAttackIds=['a','b'];
    assert.equal(nextPrimaryExpectation(state,'结束行动'),null);
    assert.equal(nextPrimaryExpectation(state,'确认攻击').playerChanges.normalAttackPlayed,true);
});
