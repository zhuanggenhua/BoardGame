/**
 * DiceThrone 条件触发交互链测试
 *
 * 覆盖"条件满足时自动触发"的交互链路径，并断言最终状态：
 * 1. 晕眩（Daze）额外攻击链
 * 2. 致盲（Blinded）攻击判定链
 * 3. 不可防御攻击链
 * 4. 终极技能链
 * 5. 治疗技能链
 * 6. Token 响应链
 * 7. 压制奖励骰链
 * 8. card-dizzy afterAttackResolved 响应窗口链
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { fixedRandom, createQueuedRandom, createRunner, cmd, createHeroMatchup } from './test-utils';
import { initializeCustomActions } from '../domain/customActions';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { INITIAL_HEALTH } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';
import { BARBARIAN_CARDS } from '../heroes/barbarian/cards';

beforeAll(() => { initializeCustomActions(); });

describe('晕眩（Daze）额外攻击链', () => {
    it('攻击方有 daze  攻击结算后触发对手额外攻击', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'daze extra attack',
            setup: createHeroMatchup('barbarian', 'monk', (core) => {
                core.players['0'].statusEffects[STATUS_IDS.DAZE] = 1;
            }),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'slap-5' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'), cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),
                cmd('ROLL_DICE', '1'), cmd('ROLL_DICE', '1'), cmd('ROLL_DICE', '1'),
                cmd('CONFIRM_ROLL', '1'),
                cmd('SELECT_ABILITY', '1', { abilityId: 'fist-technique-5' }),
                cmd('ADVANCE_PHASE', '1'),
                cmd('ROLL_DICE', '0'), cmd('CONFIRM_ROLL', '0'),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                turnPhase: 'main2', activePlayerId: '0',
                players: { '0': { statusEffects: { [STATUS_IDS.DAZE]: 0 } } },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('攻击方无 daze  正常结算无额外攻击', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'no daze',
            setup: createHeroMatchup('barbarian', 'monk'),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'slap-5' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'), cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),
            ],
            expect: { turnPhase: 'main2', activePlayerId: '0' },
        });
        expect(result.passed).toBe(true);
    });
});

describe('致盲（Blinded）攻击判定链', () => {
    it('d6=1  攻击失败，跳过攻击直接进入 main2', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'blinded d6=1',
            setup: createHeroMatchup('barbarian', 'monk', (core) => {
                core.players['0'].statusEffects[STATUS_IDS.BLINDED] = 1;
            }),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'slap-5' }),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': { statusEffects: { [STATUS_IDS.BLINDED]: 0 } },
                    '1': { hp: INITIAL_HEALTH },
                },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('d6=2  攻击失败（边界值）', () => {
        const values = Array(15).fill(1).concat([2]);
        const runner = createRunner(createQueuedRandom(values));
        const result = runner.run({
            name: 'blinded d6=2',
            setup: createHeroMatchup('barbarian', 'monk', (core) => {
                core.players['0'].statusEffects[STATUS_IDS.BLINDED] = 1;
            }),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'slap-5' }),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': { statusEffects: { [STATUS_IDS.BLINDED]: 0 } },
                    '1': { hp: INITIAL_HEALTH },
                },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('d6=3  攻击成功（边界值），进入防御并结算', () => {
        const values = Array(5).fill(1).concat([3]).concat(Array(4).fill(1));
        const runner = createRunner(createQueuedRandom(values));
        const result = runner.run({
            name: 'blinded d6=3',
            setup: createHeroMatchup('barbarian', 'monk', (core) => {
                core.players['0'].statusEffects[STATUS_IDS.BLINDED] = 1;
            }),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'slap-5' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'), cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),
            ],
            expect: {
                turnPhase: 'main2',
                players: { '0': { statusEffects: { [STATUS_IDS.BLINDED]: 0 } } },
            },
        });
        expect(result.passed).toBe(true);
    });
});

describe('不可防御攻击链', () => {
    it('violent-assault 不可防御  跳过防御直接结算', () => {
        const runner = createRunner(createQueuedRandom([6, 6, 6, 6, 1]));
        const result = runner.run({
            name: 'violent-assault',
            setup: createHeroMatchup('barbarian', 'monk'),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'violent-assault' }),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': { hp: INITIAL_HEALTH - 5, statusEffects: { [STATUS_IDS.DAZE]: 1 } },
                },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('all-out-strike 不可防御  跳过防御', () => {
        const runner = createRunner(createQueuedRandom([1, 1, 6, 6, 4]));
        const result = runner.run({
            name: 'all-out-strike',
            setup: createHeroMatchup('barbarian', 'monk'),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'all-out-strike' }),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                players: { '1': { hp: INITIAL_HEALTH - 4 } },
            },
        });
        expect(result.passed).toBe(true);
    });
});

describe('终极技能链', () => {
    it('reckless-strike 大顺子 15 伤害 + 4 自伤', () => {
        // 大顺子: [2,3,4,5,6]
        const runner = createRunner(createQueuedRandom([2, 3, 4, 5, 6]));
        const result = runner.run({
            name: 'reckless-strike',
            setup: createHeroMatchup('barbarian', 'monk'),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'reckless-strike' }),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': { hp: INITIAL_HEALTH - 4 },
                    '1': { hp: INITIAL_HEALTH - 15 },
                },
            },
        });
        expect(result.passed).toBe(true);
    });
});

describe('治疗技能链', () => {
    it('steadfast-3 治疗  跳过防御 + HP 恢复', () => {
        const runner = createRunner(createQueuedRandom([4, 4, 4, 1, 1]));
        const result = runner.run({
            name: 'steadfast heal',
            setup: createHeroMatchup('barbarian', 'monk', (core) => {
                core.players['0'].resources[RESOURCE_IDS.HP] = INITIAL_HEALTH - 10;
            }),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'steadfast-3' }),
                cmd('ADVANCE_PHASE', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': { hp: INITIAL_HEALTH - 10 + 4 },
                    '1': { hp: INITIAL_HEALTH },
                },
            },
        });
        expect(result.passed).toBe(true);
    });
});

describe('Token 响应链', () => {
    it('防御方跳过 token 响应  正常进入 main2', () => {
        const runner = createRunner(fixedRandom, false); // silent=false 打印步骤
        const result = runner.run({
            name: 'token response - defender skip',
            setup: createHeroMatchup('barbarian', 'monk', (core) => {
                core.players['1'].tokens[TOKEN_IDS.TAIJI] = 2;
            }),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'slap-5' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'), cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),
                cmd('SKIP_TOKEN_RESPONSE', '1'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': { tokens: { [TOKEN_IDS.TAIJI]: 2 } },
                },
            },
        });
        // 调试：打印每步结果
        console.log('=== Token响应测试步骤 ===');
        result.steps.forEach(s => console.log(`Step ${s.step} ${s.command} [${s.playerId}]: ${s.success ? 'OK' : 'FAIL:'+s.error} events=[${s.events.join(',')}]`));
        console.log('finalPhase:', result.finalState.sys.phase);
        console.log('interaction.current:', JSON.stringify(result.finalState.sys.interaction?.current?.kind));
        expect(result.passed).toBe(true);
    });

    it('攻击方跳过 token 响应  正常进入 main2', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'token response - attacker skip',
            setup: createHeroMatchup('barbarian', 'monk', (core) => {
                core.players['0'].tokens[TOKEN_IDS.TAIJI] = 2;
            }),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'slap-5' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'), cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),
                cmd('SKIP_TOKEN_RESPONSE', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': { tokens: { [TOKEN_IDS.TAIJI]: 2 } },
                },
            },
        });
        expect(result.passed).toBe(true);
    });
});

describe('压制奖励骰链', () => {
    it('suppress  投掷3奖励骰  造成总和伤害', () => {
        const values = [1, 1, 6, 6, 4, 1, 1, 1, 3, 4, 5];
        const runner = createRunner(createQueuedRandom(values));
        const result = runner.run({
            name: 'suppress bonus dice',
            setup: createHeroMatchup('barbarian', 'barbarian'),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'suppress' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'), cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),
                cmd('SKIP_BONUS_DICE_REROLL', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                players: { '1': { hp: INITIAL_HEALTH - 12 } },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('suppress 奖励骰总和>14  额外施加脑震荡', () => {
        const values = [1, 1, 6, 6, 4, 1, 1, 1, 5, 5, 6];
        const runner = createRunner(createQueuedRandom(values));
        const result = runner.run({
            name: 'suppress concussion',
            setup: createHeroMatchup('barbarian', 'barbarian'),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'suppress' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'), cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),
                cmd('SKIP_BONUS_DICE_REROLL', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': {
                        hp: INITIAL_HEALTH - 16,
                        statusEffects: { [STATUS_IDS.CONCUSSION]: 1 },
                    },
                },
            },
        });
        expect(result.passed).toBe(true);
    });
});

describe('card-dizzy afterAttackResolved 响应窗口链', () => {
    const cardDizzy = BARBARIAN_CARDS.find(c => c.id === 'card-dizzy')!;

    it('伤害>=8 + 手牌有 card-dizzy  打出  施加脑震荡', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'card-dizzy play',
            setup: createHeroMatchup('barbarian', 'barbarian', (core) => {
                core.players['0'].hand = [{ ...cardDizzy }];
            }),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'slap-5' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'), cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),
                cmd('PLAY_CARD', '0', { cardId: 'card-dizzy' }),
                cmd('RESPONSE_PASS', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': {
                        hp: INITIAL_HEALTH - 8,
                        statusEffects: { [STATUS_IDS.CONCUSSION]: 1 },
                    },
                },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('伤害>=8 + 手牌有 card-dizzy  跳过  不施加脑震荡', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: 'card-dizzy skip',
            setup: createHeroMatchup('barbarian', 'barbarian', (core) => {
                core.players['0'].hand = [{ ...cardDizzy }];
            }),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'), cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'slap-5' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'), cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),
                cmd('RESPONSE_PASS', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': {
                        hp: INITIAL_HEALTH - 8,
                        statusEffects: { [STATUS_IDS.CONCUSSION]: 0 },
                    },
                },
            },
        });
        expect(result.passed).toBe(true);
    });

    it('伤害<8  不触发 afterAttackResolved 窗口', () => {
        const runner = createRunner(createQueuedRandom([1, 1, 1, 4, 4, 1, 1, 1]));
        const result = runner.run({
            name: 'card-dizzy insufficient damage',
            setup: createHeroMatchup('barbarian', 'barbarian', (core) => {
                core.players['0'].hand = [{ ...cardDizzy }];
            }),
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'), cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'slap-3' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '1'), cmd('CONFIRM_ROLL', '1'),
                cmd('ADVANCE_PHASE', '1'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '1': {
                        hp: INITIAL_HEALTH - 4,
                        statusEffects: { [STATUS_IDS.CONCUSSION]: 0 },
                    },
                },
            },
        });
        expect(result.passed).toBe(true);
    });
});