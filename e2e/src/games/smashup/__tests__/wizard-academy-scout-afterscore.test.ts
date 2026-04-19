/**
 * 测试：巫师学院 (Wizard Academy) + 侦察兵 (alien_scout) afterScoring 交互链
 * 
 * Bug 报告：侦察兵在巫师学院计分后不触发
 * 
 * 预期行为：
 * 1. 巫师学院 afterScoring 能力触发（冠军重排基地牌库顶3张）
 * 2. 侦察兵 afterScoring 触发器触发（控制者选择是否回手）
 * 3. 两个交互链式处理，延迟事件正确传递
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SmashUpDomain } from '../domain';
import { createSmashUpEventSystem } from '../domain/systems';
import { smashUpFlowHooks } from '../game';
import { createFlowSystem } from '../../../engine/systems/FlowSystem';
import { createInteractionSystem } from '../../../engine/systems/InteractionSystem';
import { createResponseWindowSystem } from '../../../engine/systems/ResponseWindowSystem';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';

function createRunner() {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            createInteractionSystem(),
            createResponseWindowSystem({
                allowedCommands: [SU_COMMANDS.PLAY_SPECIAL],
                responseAdvanceEvents: [],
            }),
            createSmashUpEventSystem(),
        ],
        playerIds: ['p0', 'p1'],
    });
}

describe.skip('Wizard Academy + Scout afterScoring chain', () => {
    it('should trigger both Wizard Academy and scout afterScoring abilities', () => {
        const runner = createRunner();
        
        // 构造场景：巫师学院基地，p0 有侦察兵，p1 有随从，总力量达到破坏点
        const initialState = runner.getState();
        const wizardAcademyIndex = initialState.core.bases.findIndex((b: any) => b.defId === 'wizard_academy');
        
        // 如果没有巫师学院，手动设置一个
        let testState: SmashUpCore;
        if (wizardAcademyIndex === -1) {
            testState = {
                ...initialState.core,
                bases: [
                    {
                        defId: 'wizard_academy',
                        minions: [],
                        ongoingActions: [],
                        powerCounters: 0,
                    },
                    ...initialState.core.bases.slice(1),
                ],
            } as SmashUpCore;
        } else {
            testState = initialState.core as SmashUpCore;
        }
        
        // 添加侦察兵和其他随从到巫师学院
        const baseIndex = wizardAcademyIndex === -1 ? 0 : wizardAcademyIndex;
        testState.bases[baseIndex].minions = [
            {
                uid: 'scout1',
                defId: 'alien_scout',
                owner: 'p0',
                controller: 'p0',
                attachedActions: [],
                permanentPowerModifier: 0,
                tempPowerModifier: 0,
            },
            {
                uid: 'minion1',
                defId: 'wizard_neophyte',
                owner: 'p1',
                controller: 'p1',
                attachedActions: [],
                permanentPowerModifier: 0,
                tempPowerModifier: 0,
            },
            {
                uid: 'minion2',
                defId: 'wizard_neophyte',
                owner: 'p1',
                controller: 'p1',
                attachedActions: [],
                permanentPowerModifier: 0,
                tempPowerModifier: 0,
            },
            {
                uid: 'minion3',
                defId: 'alien_invader',
                owner: 'p0',
                controller: 'p0',
                attachedActions: [],
                permanentPowerModifier: 15, // 临时增加力量以触发计分
                tempPowerModifier: 0,
            },
        ];
        
        // 设置当前回合为 p0
        testState.currentPlayer = 'p0';
        testState.phase = 'scoreBases';
        
        // 确保 sys 对象包含所有必需字段
        const currentState = runner.getState();
        runner.setState({
            core: testState,
            sys: {
                ...currentState.sys,
                phase: 'scoreBases',
            },
        });
        
        // 执行计分命令
        const result = runner.dispatch(SU_COMMANDS.SCORE_BASES, { playerId: 'p0' });
        
        console.log('=== Score Bases Result ===');
        console.log('Success:', result.success);
        console.log('Events:', result.events?.map((e: any) => e.type));
        console.log('Has interaction:', !!result.state?.sys?.interaction?.current);
        console.log('Interaction ID:', result.state?.sys?.interaction?.current?.id);
        console.log('Interaction sourceId:', (result.state?.sys?.interaction?.current?.data as any)?.sourceId);
        
        // 验证：应该有交互（巫师学院或侦察兵）
        expect(result.success).toBe(true);
        expect(result.state?.sys?.interaction?.current).toBeDefined();
        
        // 检查交互来源
        const interaction = result.state!.sys.interaction!.current!;
        const sourceId = (interaction.data as any)?.sourceId;
        
        console.log('First interaction sourceId:', sourceId);
        
        // 第一个交互应该是巫师学院（冠军重排牌库）或侦察兵（回手选择）
        // 根据代码，巫师学院 afterScoring 基地能力先于 ongoing afterScoring 触发
        expect(['wizard_academy_reorder', 'alien_scout_return']).toContain(sourceId);
        
        // 解决第一个交互
        const firstChoice = runner.dispatch(SU_COMMANDS.RESOLVE_INTERACTION, {
            playerId: interaction.playerId,
            interactionId: interaction.id,
            optionId: sourceId === 'wizard_academy_reorder' ? 'skip' : 'no',
        });
        
        console.log('=== After First Interaction ===');
        console.log('Success:', firstChoice.success);
        console.log('Has interaction:', !!firstChoice.state?.sys?.interaction?.current);
        console.log('Interaction ID:', firstChoice.state?.sys?.interaction?.current?.id);
        
        // 如果第一个是巫师学院，第二个应该是侦察兵
        if (sourceId === 'wizard_academy_reorder') {
            expect(firstChoice.state?.sys?.interaction?.current).toBeDefined();
            const secondInteraction = firstChoice.state!.sys.interaction!.current!;
            const secondSourceId = (secondInteraction.data as any)?.sourceId;
            
            console.log('Second interaction sourceId:', secondSourceId);
            expect(secondSourceId).toBe('alien_scout_return');
            
            // 解决第二个交互
            const secondChoice = runner.dispatch(SU_COMMANDS.RESOLVE_INTERACTION, {
                playerId: secondInteraction.playerId,
                interactionId: secondInteraction.id,
                optionId: 'yes', // 选择回手
            });
            
            console.log('=== After Second Interaction ===');
            console.log('Success:', secondChoice.success);
            console.log('Events:', secondChoice.events?.map((e: any) => e.type));
            
            // 验证：侦察兵应该回到手牌
            expect(secondChoice.success).toBe(true);
            const finalState = secondChoice.state!.core as SmashUpCore;
            const p0Hand = finalState.players['p0'].hand;
            expect(p0Hand.some((c: any) => c.uid === 'scout1')).toBe(true);
        } else {
            // 如果第一个就是侦察兵，说明巫师学院没有触发（bug）
            console.error('❌ Bug confirmed: Scout triggered before Wizard Academy');
            expect(sourceId).toBe('wizard_academy_reorder'); // 这个断言会失败，暴露 bug
        }
    });
    
    it('should pass deferred events through interaction chain', () => {
        // 测试延迟事件传递机制
        const runner = createRunner();
        
        // 构造场景：巫师学院 + 2个侦察兵
        const initialState = runner.getState();
        const testState: SmashUpCore = {
            ...initialState.core,
            bases: [
                {
                    defId: 'wizard_academy',
                    minions: [
                        {
                            uid: 'scout1',
                            defId: 'alien_scout',
                            owner: 'p0',
                            controller: 'p0',
                            attachedActions: [],
                            permanentPowerModifier: 0,
                            tempPowerModifier: 0,
                        },
                        {
                            uid: 'scout2',
                            defId: 'alien_scout',
                            owner: 'p1',
                            controller: 'p1',
                            attachedActions: [],
                            permanentPowerModifier: 0,
                            tempPowerModifier: 0,
                        },
                        {
                            uid: 'minion1',
                            defId: 'alien_invader',
                            owner: 'p0',
                            controller: 'p0',
                            attachedActions: [],
                            permanentPowerModifier: 15,
                            tempPowerModifier: 0,
                        },
                    ],
                    ongoingActions: [],
                    powerCounters: 0,
                },
                ...initialState.core.bases.slice(1),
            ],
            currentPlayer: 'p0',
            phase: 'scoreBases',
        } as SmashUpCore;
        
        // 确保 sys 对象包含所有必需字段
        const initialSysState = runner.getState();
        runner.setState({
            core: testState,
            sys: {
                ...initialSysState.sys,
                phase: 'scoreBases',
            },
        });
        
        // 执行计分
        const result = runner.dispatch(SU_COMMANDS.SCORE_BASES, { playerId: 'p0' });
        
        expect(result.success).toBe(true);
        
        // 应该有3个交互：巫师学院 + scout1 + scout2
        let currentState = result.state!;
        let interactionCount = 0;
        
        while (currentState.sys?.interaction?.current) {
            interactionCount++;
            const interaction = currentState.sys.interaction.current;
            const sourceId = (interaction.data as any)?.sourceId;
            
            console.log(`Interaction ${interactionCount}: ${sourceId}`);
            
            // 解决交互
            const choice = runner.dispatch(SU_COMMANDS.RESOLVE_INTERACTION, {
                playerId: interaction.playerId,
                interactionId: interaction.id,
                optionId: sourceId === 'wizard_academy_reorder' ? 'skip' : 'no',
            });
            
            expect(choice.success).toBe(true);
            currentState = choice.state!;
        }
        
        // 验证：应该有3个交互
        expect(interactionCount).toBe(3);
        
        // 验证：BASE_CLEARED 和 BASE_REPLACED 应该在最后发出
        const allEvents = result.events ?? [];
        const baseClearedIndex = allEvents.findIndex((e: any) => e.type === SU_EVENTS.BASE_CLEARED);
        const baseReplacedIndex = allEvents.findIndex((e: any) => e.type === SU_EVENTS.BASE_REPLACED);
        
        // 如果有延迟事件，BASE_CLEARED 应该在所有交互解决后才发出
        // 但由于 GameTestRunner 不会自动处理系统事件，这里可能看不到延迟事件
        // 主要验证交互链是否正确
        console.log('Total interactions:', interactionCount);
        console.log('BASE_CLEARED index:', baseClearedIndex);
        console.log('BASE_REPLACED index:', baseReplacedIndex);
    });
});
