/**
 * 测试圣骑士神圣祝福 token 不能被移除
 * 
 * 规则：神圣祝福 (Blessing of Divinity) 的 removable: false
 * 表示这个 token 不能被 REMOVE_STATUS 命令移除（只能通过触发效果自动消耗）
 */

import { describe, it, expect } from 'vitest';
import { createHeroMatchup, fixedRandom } from './test-utils';
import { TOKEN_IDS } from '../domain/ids';
import { DiceThroneDomain } from '../domain';
import type { RemoveStatusCommand, TransferStatusCommand } from '../domain/types';

describe('圣骑士神圣祝福 token 不可移除', () => {
    it('神圣祝福 token 定义中 removable 字段为 false', () => {
        const setup = createHeroMatchup('paladin', 'paladin');
        const state = setup(['0', '1'], fixedRandom);

        const blessingDef = (state.core.tokenDefinitions ?? []).find(
            def => def.id === TOKEN_IDS.BLESSING_OF_DIVINITY
        );

        expect(blessingDef).toBeDefined();
        expect(blessingDef!.passiveTrigger).toBeDefined();
        expect(blessingDef!.passiveTrigger!.removable).toBe(false);
    });

    it('execute 层：REMOVE_STATUS 不移除 removable: false 的 token', () => {
        const setup = createHeroMatchup('paladin', 'paladin', (core) => {
            // 给玩家 0 一个神圣祝福 token
            core.players['0'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] = 1;
        });
        const initialState = setup(['0', '1'], fixedRandom);

        // 直接调用 execute 函数
        const command: RemoveStatusCommand = {
            type: 'REMOVE_STATUS',
            playerId: '0',
            payload: { targetPlayerId: '0', statusId: TOKEN_IDS.BLESSING_OF_DIVINITY },
            timestamp: Date.now(),
        };

        const events = DiceThroneDomain.execute(initialState, command, fixedRandom);

        // 验证：没有生成 TOKEN_CONSUMED 事件（因为 removable: false）
        const tokenConsumedEvents = events.filter(e => e.type === 'TOKEN_CONSUMED');
        expect(tokenConsumedEvents).toHaveLength(0);
    });

    it('execute 层：REMOVE_STATUS（不指定 statusId）不移除 removable: false 的 token', () => {
        const setup = createHeroMatchup('paladin', 'paladin', (core) => {
            // 给玩家 0 一个神圣祝福 token 和一个可移除的 token
            core.players['0'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] = 1;
            core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
        });
        const initialState = setup(['0', '1'], fixedRandom);

        // 直接调用 execute 函数（移除所有 token）
        const command: RemoveStatusCommand = {
            type: 'REMOVE_STATUS',
            playerId: '0',
            payload: { targetPlayerId: '0' }, // 不指定 statusId
            timestamp: Date.now(),
        };

        const events = DiceThroneDomain.execute(initialState, command, fixedRandom);

        // 验证：只生成了暴击 token 的 TOKEN_CONSUMED 事件
        const tokenConsumedEvents = events.filter(e => e.type === 'TOKEN_CONSUMED');
        expect(tokenConsumedEvents).toHaveLength(1);
        expect(tokenConsumedEvents[0].payload.tokenId).toBe(TOKEN_IDS.CRIT);
        
        // 验证：没有生成神圣祝福的 TOKEN_CONSUMED 事件
        const blessingConsumed = tokenConsumedEvents.find(
            e => e.payload.tokenId === TOKEN_IDS.BLESSING_OF_DIVINITY
        );
        expect(blessingConsumed).toBeUndefined();
    });

    it('execute 层：可移除的 token 可以正常被移除（对照组）', () => {
        const setup = createHeroMatchup('paladin', 'paladin', (core) => {
            // 给玩家 0 一个暴击 token（可移除）
            core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
        });
        const initialState = setup(['0', '1'], fixedRandom);

        // 直接调用 execute 函数
        const command: RemoveStatusCommand = {
            type: 'REMOVE_STATUS',
            playerId: '0',
            payload: { targetPlayerId: '0', statusId: TOKEN_IDS.CRIT },
            timestamp: Date.now(),
        };

        const events = DiceThroneDomain.execute(initialState, command, fixedRandom);

        // 验证：生成了 TOKEN_CONSUMED 事件
        const tokenConsumedEvents = events.filter(e => e.type === 'TOKEN_CONSUMED');
        expect(tokenConsumedEvents).toHaveLength(1);
        expect(tokenConsumedEvents[0].payload.tokenId).toBe(TOKEN_IDS.CRIT);
    });

    it('execute 层：TRANSFER_STATUS 不转移 removable: false 的 token', () => {
        const setup = createHeroMatchup('paladin', 'paladin', (core) => {
            // 给玩家 0 一个神圣祝福 token
            core.players['0'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] = 1;
        });
        const initialState = setup(['0', '1'], fixedRandom);

        // 直接调用 execute 函数
        const command: TransferStatusCommand = {
            type: 'TRANSFER_STATUS',
            playerId: '0',
            payload: {
                fromPlayerId: '0',
                toPlayerId: '1',
                statusId: TOKEN_IDS.BLESSING_OF_DIVINITY,
            },
            timestamp: Date.now(),
        };

        const events = DiceThroneDomain.execute(initialState, command, fixedRandom);

        // 验证：没有生成任何事件（因为 removable: false，转移被跳过）
        expect(events).toHaveLength(0);
    });

    it('execute 层：可移除的 token 可以正常被转移（对照组）', () => {
        const setup = createHeroMatchup('paladin', 'paladin', (core) => {
            // 给玩家 0 一个暴击 token（可移除）
            core.players['0'].tokens[TOKEN_IDS.CRIT] = 1;
        });
        const initialState = setup(['0', '1'], fixedRandom);

        // 直接调用 execute 函数
        const command: TransferStatusCommand = {
            type: 'TRANSFER_STATUS',
            playerId: '0',
            payload: {
                fromPlayerId: '0',
                toPlayerId: '1',
                statusId: TOKEN_IDS.CRIT,
            },
            timestamp: Date.now(),
        };

        const events = DiceThroneDomain.execute(initialState, command, fixedRandom);

        // 验证：生成了 TOKEN_CONSUMED 和 TOKEN_GRANTED 事件
        const tokenConsumedEvents = events.filter(e => e.type === 'TOKEN_CONSUMED');
        const tokenGrantedEvents = events.filter(e => e.type === 'TOKEN_GRANTED');
        
        expect(tokenConsumedEvents).toHaveLength(1);
        expect(tokenConsumedEvents[0].payload.tokenId).toBe(TOKEN_IDS.CRIT);
        expect(tokenConsumedEvents[0].payload.playerId).toBe('0');
        
        expect(tokenGrantedEvents).toHaveLength(1);
        expect(tokenGrantedEvents[0].payload.tokenId).toBe(TOKEN_IDS.CRIT);
        expect(tokenGrantedEvents[0].payload.targetId).toBe('1');
    });

    it('validate 层：REMOVE_STATUS 不允许选择 removable: false 的 token', () => {
        const setup = createHeroMatchup('paladin', 'paladin', (core) => {
            core.players['0'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] = 1;
        });
        const state = setup(['0', '1'], fixedRandom);

        state.sys.interaction.current = {
            id: 'dt-interaction-remove',
            kind: 'dt:card-interaction',
            playerId: '0',
            data: {
                id: 'pending-remove',
                playerId: '0',
                sourceCardId: 'test-card',
                type: 'selectStatus',
                titleKey: 'interaction.removeStatus',
                selectCount: 1,
                selected: [],
                targetPlayerIds: ['0'],
                requiresTargetWithStatus: true,
            },
        };

        const command: RemoveStatusCommand = {
            type: 'REMOVE_STATUS',
            playerId: '0',
            payload: { targetPlayerId: '0', statusId: TOKEN_IDS.BLESSING_OF_DIVINITY },
            timestamp: Date.now(),
        };

        const validation = DiceThroneDomain.validate(state, command);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('no_status');
    });

    it('validate 层：TRANSFER_STATUS 不允许转移 removable: false 的 token', () => {
        const setup = createHeroMatchup('paladin', 'paladin', (core) => {
            core.players['0'].tokens[TOKEN_IDS.BLESSING_OF_DIVINITY] = 1;
        });
        const state = setup(['0', '1'], fixedRandom);

        state.sys.interaction.current = {
            id: 'dt-interaction-transfer',
            kind: 'dt:card-interaction',
            playerId: '0',
            data: {
                id: 'pending-transfer',
                playerId: '0',
                sourceCardId: 'test-card',
                type: 'selectTargetStatus',
                titleKey: 'interaction.transferStatus',
                selectCount: 1,
                selected: [],
                targetPlayerIds: ['0', '1'],
            },
        };

        const command: TransferStatusCommand = {
            type: 'TRANSFER_STATUS',
            playerId: '0',
            payload: {
                fromPlayerId: '0',
                toPlayerId: '1',
                statusId: TOKEN_IDS.BLESSING_OF_DIVINITY,
            },
            timestamp: Date.now(),
        };

        const validation = DiceThroneDomain.validate(state, command);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('no_status');
    });
});
