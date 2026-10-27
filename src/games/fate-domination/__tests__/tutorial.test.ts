import { expect, it } from 'vitest';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../../engine';
import type { MatchState } from '../../../engine/types';
import { FateDominationDomain } from '../domain';
import type { FateDominationCore } from '../domain';
import { buildLocalDispatchCommand } from '../../../engine/transport/localDispatchCommand';
import { engineConfig } from '../game';
import { FateDominationTutorial, buildFateTutorialPlan, FATE_TUTORIAL_SEED } from '../tutorial';
import {applyPlayerViewToState} from '../../../engine/ai/playerView';
import type {AiDecisionContext} from '../../../engine/ai';
import {buildFateAiLegalActions,chooseFateAiAction} from '../ai';

it('教程从正式开局复演至终局，包含混选、御主、骑乘和多轮阶段', () => {
    const plan = buildFateTutorialPlan();
    expect(plan.finalState.sys.gameover).toBeTruthy();
    expect(Object.values(plan.finalState.core.players).map(player=>player.eliminated), '教程必须自然出现淘汰状态，不能用外部代表态图片替代').toContain(true);
    expect(plan.steps.some(step=>step.id==='elimination-observe')).toBe(true);
    expect(plan.steps.every(step=>step.avoidOverlapSelectors?.includes('.fd-play-summary'))).toBe(true);
    expect(plan.commands.some(command => command.type === 'CONFIRM_ATTACK' && (command.payload as { cardIds: string[] }).cardIds.some(id => id.startsWith('sc_iskandar_1')))).toBe(true);
    expect(plan.commands.some(command => command.type === 'PLAY_SKILL' && String((command.payload as { skillId: string }).skillId).startsWith('sc_iskandar_1'))).toBe(true);
    expect(plan.steps.some(step => step.id.startsWith('ui-public-cards'))).toBe(true);
    expect(plan.steps.some(step => step.id.startsWith('ui-detail'))).toBe(false);
    const masterPractice=plan.steps.find(step=>step.fateCommand?.type==='PLAY_SKILL'&&step.fateCopy?.ability?.masterId==='m_waver');
    const ridingPractice=plan.steps.find(step=>step.fateCommand?.type==='PLAY_SKILL'&&String(step.fateCommand.payload.skillId).startsWith('sc_iskandar_1'));
    expect(masterPractice?.highlightTarget).toBe('fate-self');
    expect(ridingPractice?.highlightTarget).toBe('fate-hand');
    expect(new Set(plan.commands.map(command => command.type)).size).toBeGreaterThan(8);
});

it('首次部署前无人上图，部署是玩家真实输入，落位结果停留后才进入详情教学', () => {
    const plan = buildFateTutorialPlan();
    const deployment = plan.steps.find(step=>step.fateCommand?.type==='DEPLOY_MASTER')!;
    expect(deployment.highlightTarget).toBe('fate-deployment-workshop');
    const index = plan.steps.indexOf(deployment);
    expect(plan.steps[index+1].id).toBe('first-deployment-result');
    expect(plan.steps[index+1].infoStep).toBe(true);
    expect(plan.steps.some(step=>step.fateCommand?.type==='SELECT_MASTER'||step.fateCommand?.type==='SELECT_SERVANT')).toBe(false);
    const random=createSeededRandom(FATE_TUTORIAL_SEED),ids=['0','1','2'];
    let state:MatchState<FateDominationCore>={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,FATE_TUTORIAL_SEED)};
    for(const command of plan.commands){
        if(command.type==='DEPLOY_MASTER'){
            expect(state.core.phase).toBe('outpost');
            expect(Object.values(state.core.players).every(player=>player.locationId===null)).toBe(true);
            expect(Object.values(state.core.battlefield).every(location=>location.playerIds.length===0)).toBe(true);
            break;
        }
        state=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,command,random,ids).state;
    }
});

it('自然课程中学员亲自处理战后选择，不能只观察他席选择', () => {
    const plan = buildFateTutorialPlan();
    const responses = plan.steps.filter(step => step.fateCommand?.type === 'SYS_INTERACTION_RESPOND'
        && typeof step.fateCommand.payload.optionId === 'string');
    expect(responses.map(step => step.fateCommand!.payload.optionId)).toContain('restore');
});

it('先读费用与技能门槛再支付；自动收牌先于查看弃牌，不把关闭攻击当查看操作',()=>{
    const {steps}=buildFateTutorialPlan();
    const reading=steps.findIndex(step=>step.fateCopy?.lessonId==='cardReading');
    const firstPayment=steps.findIndex(step=>step.fateCommand?.type==='USE_COMMAND_SPELL'||step.fateCommand?.type==='CONFIRM_ATTACK');
    expect(reading).toBeGreaterThan(-1);expect(reading).toBeLessThan(firstPayment);
    expect(steps[reading].fateUiInspectionSource).toBe('hand');
    const cleanup=steps.findIndex(step=>step.id==='round-return-observe');
    const discard=steps.findIndex(step=>step.fateCopy?.lessonId==='discard');
    expect(cleanup).toBeGreaterThan(reading);expect(discard).toBeGreaterThan(cleanup);
    expect(steps[discard].content).toContain('你可以于任何时候查看自己的弃牌堆');
    expect(steps[discard].content).not.toContain('关闭');
    const reward=steps.find(step=>step.fateCommand?.type==='SYS_INTERACTION_RESPOND'&&step.fateCommand.payload.optionId==='restore');
    expect(reward?.content).toContain('此战场的胜者可以恢复1枚令咒');
});

it('战场地利只讲一次，结束行动不复述正式按钮，也不新增终局复述卡',()=>{
    const {steps}=buildFateTutorialPlan();
    const battlefield=steps.find(step=>step.fateCommand?.type==='DEPLOY_MASTER'&&step.fateCommand.payload.locationId!=='workshop');
    expect(battlefield?.requireAction).toBe(true);
    expect(steps.filter(step=>!step.hiddenAutomation&&step.fateCopy?.passages.includes('terrain'))).toHaveLength(1);
    const end=steps.find(step=>step.fateCommand?.type==='PASS_ACTION');
    expect(end?.fateCopy?.passages).toEqual([]);expect(end?.hideOverlay).toBe(true);
    expect(steps.some(step=>step.id==='complete')).toBe(false);
});

it('首轮先移动到战场再出牌，骑乘用于当前战场且不强迫取消重开；他席沿正式AI竞争',()=>{
    const plan=buildFateTutorialPlan(),ids=['0','1','2'],random=createSeededRandom(FATE_TUTORIAL_SEED);
    let state:MatchState<FateDominationCore>={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,FATE_TUTORIAL_SEED)};
    let moved=false,normal=false,riding=false;
    for(const [index,command] of plan.commands.entries()){
        const step=plan.steps.find(item=>item.id===`play-${index+1}`);
        const ability=step?.fateCopy?.ability;
        if(ability){
            const player=state.core.players[command.playerId];
            expect(ability.masterId??ability.servantId).toBe(ability.masterId?player.masterId:player.servantId);
            expect(ability.skillId).toBe(String((command.payload as {skillId:string}).skillId).split(':')[0]);
        }
        if(step?.fateCopy?.observer)expect(step.fateCopy.observer.playerId).toBe(command.playerId);
        if(command.playerId!=='0'&&!['SELECT_MASTER','SELECT_SERVANT'].includes(command.type)){
            const visibleState=applyPlayerViewToState({gameId:engineConfig.gameId,domain:engineConfig.domain,systems:engineConfig.systems},state,command.playerId);
            const legalActions=buildFateAiLegalActions({playerId:command.playerId,state:visibleState});
            const context={gameId:'fate-domination',matchId:'tutorial-audit',playerId:command.playerId,visibleState,legalActions,interaction:null,responseWindow:null,source:'local'} as AiDecisionContext;
            expect(legalActions.find(action=>action.actionId===chooseFateAiAction(context)?.actionId)?.commands[0]).toMatchObject({type:command.type,payload:command.payload});
        }
        if(state.core.round===1&&command.playerId==='0'){
            if(command.type==='MOVE_PLAYER'){expect(normal).toBe(false);moved=true;}
            if(command.type==='CONFIRM_ATTACK'){expect(moved).toBe(true);expect(state.core.players['0'].locationId).toBe('miyama');normal=true;}
            if(command.type==='PLAY_SKILL'&&String((command.payload as {skillId:string}).skillId).startsWith('sc_iskandar_1')){expect(normal).toBe(true);riding=true;}
            expect(command.type).not.toBe('SYS_INTERACTION_CANCEL');
        }
        state=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,command,random,ids).state;
    }
    expect({moved,normal,riding}).toEqual({moved:true,normal:true,riding:true});
    expect(state.sys.gameover).toBeTruthy();
});

it('正式教程系统逐步承接全部计划动作，自动命令不越过当前选择，回退恢复权威状态', () => {
    const random = createSeededRandom(FATE_TUTORIAL_SEED);
    const ids = ['0', '1', '2'];
    let state: MatchState<FateDominationCore> = { core: FateDominationDomain.setup(ids, random), sys: createInitialSystemState(ids, engineConfig.systems, FATE_TUTORIAL_SEED) };
    const send = (type: string, payload: unknown, playerId = '0', automatic = false) => {
        const data = payload as Record<string,unknown>;
        const local = buildLocalDispatchCommand({ commandType: type, payload: automatic ? { ...data, __tutorialPlayerId: playerId, __tutorialAiCommand: true } : type.startsWith('SYS_INTERACTION_') ? { ...data, interactionId: state.sys.interaction.current?.id } : payload, state, localPregameControlledPlayerId: '0' });
        const result = executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems }, state, local.command, random, ids);
        expect(result.success, `${state.sys.tutorial.step?.id}/${type}: ${result.error ?? ''}`).toBe(true);
        state = result.state;
    };
    send('SYS_TUTORIAL_START', { manifest: FateDominationTutorial });
    expect(state.sys.tutorial.step?.avoidOverlapSelectors).toContain('.fd-play-summary');
    let iterations = 0;
    while (state.sys.tutorial.active && iterations++ < 1000) {
        const step = FateDominationTutorial.steps.find(item => item.id === state.sys.tutorial.step?.id)! as typeof FateDominationTutorial.steps[number] & { fateCommand?: { type: string; payload: object } };
        if (step.aiActions?.length) {
            for (const command of step.aiActions) send(command.commandType, command.payload, command.playerId, true);
            send('SYS_TUTORIAL_AI_CONSUMED', { stepId: step.id });
            if (state.sys.tutorial.step?.id === step.id) send('SYS_TUTORIAL_NEXT', { reason: 'manual' });
        } else if (step.fateCommand) send(step.fateCommand.type, step.fateCommand.payload);
        else send('SYS_TUTORIAL_NEXT', { reason: step.requireAction ? 'auto' : 'manual' });
    }
    expect(state.sys.tutorial.active).toBe(false);
    expect(state.sys.gameover).toBeTruthy();
    expect(iterations).toBeLessThan(1000);
});
