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
import {fateTutorialAllows} from '../ui/tutorialContract';
import { fateDominationGameRuntimeAdapter } from '../runtimeAdapter';

it('教程从正式开局复演至终局，包含混选、御主、骑乘和多轮阶段', () => {
    const plan = buildFateTutorialPlan();
    expect(plan.finalState.sys.gameover).toBeTruthy();
    expect(Object.values(plan.finalState.core.players).map(player=>player.eliminated), '教程必须自然出现淘汰状态，不能用外部代表态图片替代').toContain(true);
    expect(plan.steps.some(step=>step.id==='elimination-observe')).toBe(true);
    expect(plan.steps.every(step=>step.avoidOverlapSelectors?.includes('.fd-play-summary'))).toBe(true);
    expect(plan.steps.find(step=>step.id==='map-camera')?.avoidOverlapSelectors).toContain('.fd-runtime-map-landmark:not([data-tutorial-map-landmark="battle-track"])');
    expect(plan.commands.some(command => command.type === 'CONFIRM_ATTACK' && (command.payload as { cardIds: string[] }).cardIds.some(id => id.startsWith('sc_iskandar_1')))).toBe(true);
    expect(plan.commands.some(command => command.type === 'PLAY_SKILL' && String((command.payload as { skillId: string }).skillId).startsWith('sc_iskandar_1'))).toBe(true);
    expect(plan.steps.some(step => step.id.startsWith('ui-public-cards'))).toBe(true);
    expect(plan.steps.some(step => step.id.startsWith('ui-detail'))).toBe(false);
    const observedBattleDeployment=plan.steps.find(step=>step.fateCopy?.lessonId==='battleDeployment'&&step.fateCommand?.type==='DEPLOY_MASTER');
    expect(observedBattleDeployment?.highlightTarget).toBe(`fate-deployment-${observedBattleDeployment?.fateCommand?.payload.locationId}`);
    expect(['miyama','shinto']).toContain(observedBattleDeployment?.fateCommand?.payload.locationId);
    const masterPractice=plan.steps.find(step=>step.fateCommand?.type==='PLAY_SKILL'&&step.fateCopy?.ability?.masterId==='m_waver');
    const ridingPractice=plan.steps.find(step=>step.fateCommand?.type==='PLAY_SKILL'&&String(step.fateCommand.payload.skillId).startsWith('sc_iskandar_1'));
    expect(masterPractice?.highlightTarget).toBe('fate-master-abilities');
    expect(ridingPractice?.highlightTarget).toBe('fate-hand');
    expect(new Set(plan.commands.map(command => command.type)).size).toBeGreaterThan(8);
});

it('首席先占工房+2，学员面对三个合法+1点位并以正式输入部署', () => {
    const plan = buildFateTutorialPlan();
    const deployment = plan.steps.find(step=>step.fateCommand?.type==='DEPLOY_MASTER')!;
    const firstSeatDeployment=plan.steps.find(step=>step.aiActions?.some(action=>action.commandType==='DEPLOY_MASTER'&&action.playerId==='1'))!;
    expect(firstSeatDeployment.autoAdvanceAfterAi).toBe(false);
    expect(firstSeatDeployment.highlightTarget).toBe('fate-deployment-workshop');
    expect(firstSeatDeployment.fateCopy?.passages).toContain('workshopOrder');
    expect(firstSeatDeployment.content).toContain('玩家若选择部署于此，由数字的由高到低依次部署');
    expect(deployment.highlightTarget).toBe('fate-map');
    expect(deployment.fateCopy?.passages).not.toContain('workshopOrder');
    expect(new Set(deployment.fateCommandOptions?.map(option=>option.payload.locationId))).toEqual(new Set(['workshop','miyama','shinto']));
    expect(deployment.fateCommandOptions?.filter(option=>option.payload.locationId==='workshop').map(option=>option.payload.deploymentSlot)).toEqual([1,2,3]);
    const index = plan.steps.indexOf(deployment);
    expect(plan.steps[index+1].id).toBe('first-deployment-result');
    expect(plan.steps[index+1].infoStep).toBe(true);
    expect(plan.steps.some(step=>step.fateCommand?.type==='SELECT_MASTER'||step.fateCommand?.type==='SELECT_SERVANT')).toBe(false);
    const random=createSeededRandom(FATE_TUTORIAL_SEED),ids=['1','0','2'];
    let state:MatchState<FateDominationCore>={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,FATE_TUTORIAL_SEED)};
    for(const command of plan.commands){
        if(command.type==='DEPLOY_MASTER'&&command.playerId==='0'){
            expect(state.core.phase).toBe('outpost');
            expect(state.core.players['1']).toMatchObject({locationId:'workshop',deploymentSlot:0});
            expect(state.core.players['0'].locationId).toBeNull();
            expect(state.core.battlefield.workshop.playerIds).toEqual(['1']);
            expect(Object.values(state.core.battlefield).filter(location=>location.id!=='workshop').every(location=>location.playerIds.length===0)).toBe(true);
            for(const slot of [1,2,3])expect(FateDominationDomain.validate(state,{type:'DEPLOY_MASTER',playerId:'0',payload:{locationId:'workshop',deploymentSlot:slot},timestamp:1}).valid).toBe(true);
            break;
        }
        state=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,command,random,ids).state;
    }
});

it('正式教程运行时按真实教程计划把学员放在第二顺位', () => {
    const setup = fateDominationGameRuntimeAdapter.resolveLocalSetup?.({
        searchParams: new URLSearchParams(),
        tutorialMode: true,
    });
    expect(setup?.numPlayers).toBe(3);
    expect(setup?.setupData).toEqual({ turnOrder: ['1', '0', '2'] });
    const state = FateDominationDomain.setup(['0', '1', '2'], createSeededRandom(FATE_TUTORIAL_SEED), setup?.setupData);
    expect(state.turnOrder).toEqual(['1', '0', '2']);
    expect(state.currentPlayerId).toBe('1');
    expect(fateDominationGameRuntimeAdapter.resolveLocalSetup?.({
        searchParams: new URLSearchParams(),
        tutorialMode: false,
    })).toBeNull();
});

it.each(['miyama','shinto'] as const)('首次部署选择%s后，正式教程进入相应真实续程',locationId=>{
    const ids=['1','0','2'],random=createSeededRandom(FATE_TUTORIAL_SEED);
    const planned=buildFateTutorialPlan(locationId).commands;let actionIndex=0;
    let state:MatchState<FateDominationCore>={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,FATE_TUTORIAL_SEED)};
    const send=(type:string,payload:unknown,playerId='0',automatic=false)=>{
        const data=payload as Record<string,unknown>;
        if(['SELECT_MASTER','SELECT_SERVANT','DEPLOY_MASTER','SELECT_ATTACK_CARD','CONFIRM_ATTACK','INSPECT_CARD','ADVANCE_PHASE','MOVE_PLAYER','PASS_ACTION','RESOLVE_LOCATION','PLAY_SKILL','USE_COMMAND_SPELL','SYS_INTERACTION_RESPOND','SYS_INTERACTION_CANCEL'].includes(type)){
            const expected=planned[actionIndex++];const expectedPayload={...(expected?.payload as Record<string,unknown>??{})};delete expectedPayload.interactionId;
            const actualPayload={...data};delete actualPayload.interactionId;
            expect({type,playerId,payload:actualPayload},`首次部署${locationId}后，第${actionIndex-1}项实际动作应与真实复演计划一致`).toEqual({type:expected?.type,playerId:expected?.playerId,payload:expectedPayload});
        }
        const local=buildLocalDispatchCommand({commandType:type,payload:automatic?{...data,__tutorialPlayerId:playerId,__tutorialAiCommand:true}:type.startsWith('SYS_INTERACTION_')?{...data,interactionId:state.sys.interaction.current?.id}:payload,state,localPregameControlledPlayerId:'0'});
        const result=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,local.command,random,ids);
        expect(result.success,`${state.sys.tutorial.step?.id}/${type}: ${result.error??''}`).toBe(true);state=result.state;
    };
    send('SYS_TUTORIAL_START',{manifest:FateDominationTutorial});
    let branchChosen:string|undefined;
    for(let iteration=0;state.sys.tutorial.active&&iteration<1000;iteration++){
        const step=state.sys.tutorial.step!;
        if(step.aiActions?.length){for(const action of step.aiActions)send(action.commandType,action.payload,action.playerId,true);send('SYS_TUTORIAL_AI_CONSUMED',{stepId:step.id});if(state.sys.tutorial.step?.id===step.id)send('SYS_TUTORIAL_NEXT',{reason:step.autoAdvanceAfterAi===false?'manual':'auto'});continue;}
        if(step.fateCommandOptions?.length){
            expect(new Set(step.fateCommandOptions.map(option=>option.payload.locationId))).toEqual(new Set(['workshop','miyama','shinto']));
            expect(fateTutorialAllows(state.sys.tutorial,'DEPLOY_MASTER',{locationId:'recon',deploymentSlot:undefined})).toBe(false);
            for(const option of step.fateCommandOptions.filter(candidate=>candidate.payload.locationId==='workshop'))
                expect(fateTutorialAllows(state.sys.tutorial,option.type,option.payload)).toBe(true);
            const option=step.fateCommandOptions.find(candidate=>candidate.payload.locationId===locationId)!;
            expect(fateTutorialAllows(state.sys.tutorial,option.type,option.payload)).toBe(true);
            send(option.type,option.payload);
            branchChosen=state.sys.tutorial.selectedBranch;
            expect(branchChosen).toBe(locationId);
            expect(state.sys.tutorial.steps.every(candidate=>!candidate.branch||candidate.branch===locationId)).toBe(true);
            continue;
        }
        if(step.fateCommand)send(step.fateCommand.type,step.fateCommand.payload);
        else send('SYS_TUTORIAL_NEXT',{reason:step.requireAction?'auto':'manual'});
    }
    expect(branchChosen).toBe(locationId);expect(state.sys.tutorial.active).toBe(false);expect(state.sys.gameover).toBeTruthy();
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
    const plan=buildFateTutorialPlan();
    const {steps}=plan;
    const battlefield=steps.find(step=>step.fateCommand?.type==='DEPLOY_MASTER'&&step.fateCommand.payload.locationId!=='workshop');
    expect(battlefield?.requireAction).toBe(true);
    expect(steps.filter(step=>!step.hiddenAutomation&&step.fateCopy?.passages.includes('terrain'))).toHaveLength(1);
    const end=steps.find(step=>step.fateCommand?.type==='PASS_ACTION');
    expect(end?.fateCopy?.passages).toEqual([]);expect(end?.hideOverlay).toBe(true);
    expect(steps.some(step=>step.id==='complete')).toBe(false);
    expect(plan.finalState.sys.gameover).toBeTruthy();
    const lastActionIndex=steps.reduce((last,step,index)=>step.id.startsWith('play-')?index:last,-1);
    expect(lastActionIndex).toBeGreaterThan(-1);
    expect(steps.slice(lastActionIndex+1).some(step=>step.id==='round-return-observe')).toBe(false);
});

it('首轮先移动到战场再出牌，骑乘在实际战场触发且不强迫取消重开；他席沿正式AI竞争',()=>{
    const plan=buildFateTutorialPlan(),ids=['1','0','2'],random=createSeededRandom(FATE_TUTORIAL_SEED);
    let state:MatchState<FateDominationCore>={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,FATE_TUTORIAL_SEED)};
    let moved=false,normal=false,riding=false;let movementDestination:string|undefined;
    for(const [index,command] of plan.commands.entries()){
        const step=plan.steps.find(item=>item.id===`play-${index+1}`);
        const ability=step?.fateCopy?.ability;
        if(ability){
            const player=state.core.players[command.playerId];
            const sourceId=String((command.payload as {skillId:string}).skillId);
            if(ability.attackId){
                expect(player.hand.find(card=>card.id===sourceId)?.definitionId).toBe(ability.attackId);
                expect(player.activeAttackIds).toContain(sourceId);
                expect(ability.skillId).toBe(ability.attackId);
            }else{
                expect(ability.masterId??ability.servantId).toBe(ability.masterId?player.masterId:player.servantId);
                expect(ability.skillId).toBe(sourceId.split(':')[0]);
            }
        }
        if(step?.fateCopy?.observer)expect(step.fateCopy.observer.playerId).toBe(command.playerId);
        if(command.playerId!=='0'&&!['SELECT_MASTER','SELECT_SERVANT'].includes(command.type)){
            const authoredWorkshopOpening=command.playerId==='1'&&command.type==='DEPLOY_MASTER'&&command.payload.locationId==='workshop'&&command.payload.deploymentSlot===0;
            if(authoredWorkshopOpening)expect(FateDominationDomain.validate(state,command).valid).toBe(true);
            else{
                const visibleState=applyPlayerViewToState({gameId:engineConfig.gameId,domain:engineConfig.domain,systems:engineConfig.systems},state,command.playerId);
                const legalActions=buildFateAiLegalActions({playerId:command.playerId,state:visibleState});
                const context={gameId:'fate-domination',matchId:'tutorial-audit',playerId:command.playerId,visibleState,legalActions,interaction:null,responseWindow:null,source:'local'} as AiDecisionContext;
                expect(legalActions.find(action=>action.actionId===chooseFateAiAction(context)?.actionId)?.commands[0]).toMatchObject({type:command.type,payload:command.payload});
            }
        }
        if(command.playerId==='0'){
            if(state.core.round===1){
                if(command.type==='MOVE_PLAYER'){expect(normal).toBe(false);moved=true;movementDestination=String((command.payload as {locationId:string}).locationId);}
                if(command.type==='CONFIRM_ATTACK'){expect(moved).toBe(true);expect(['miyama','shinto']).toContain(movementDestination);expect(state.core.players['0'].locationId).toBe(movementDestination);normal=true;}
                expect(command.type).not.toBe('SYS_INTERACTION_CANCEL');
            }
            if(command.type==='PLAY_SKILL'&&String((command.payload as {skillId:string}).skillId).startsWith('sc_iskandar_1')){
                expect(normal).toBe(true);expect(['miyama','shinto']).toContain(state.core.players['0'].locationId);riding=true;
            }
        }
        state=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,command,random,ids).state;
    }
    expect({moved,normal,riding}).toEqual({moved:true,normal:true,riding:true});
    expect(state.sys.gameover).toBeTruthy();
});

it('正式教程系统逐步承接全部计划动作，自动命令不越过当前选择，回退恢复权威状态', () => {
    const random = createSeededRandom(FATE_TUTORIAL_SEED);
    const ids = ['1', '0', '2'];
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
            if (state.sys.tutorial.step?.id === step.id) send('SYS_TUTORIAL_NEXT', { reason: step.autoAdvanceAfterAi===false?'manual':'auto' });
        } else if (step.fateCommand) send(step.fateCommand.type, step.fateCommand.payload);
        else send('SYS_TUTORIAL_NEXT', { reason: step.requireAction ? 'auto' : 'manual' });
    }
    expect(state.sys.tutorial.active).toBe(false);
    expect(state.sys.gameover).toBeTruthy();
    expect(iterations).toBeLessThan(1000);
});


it('课程重排仍保留交战限制和战场暗置决策，不能等到完整E2E末尾才发现漏课',()=>{
    const plan=buildFateTutorialPlan();
    const engagement=plan.steps.find(step=>step.fateCopy?.lessonId==='engagement');
    const darkLesson=plan.steps.find(step=>step.fateCopy?.passages.includes('battlefieldFaceUp'));
    const dark=plan.steps.find(step=>step.fateCopy?.lessonId==='battlefieldDarkAttack'&&step.fateCommand);
    expect(engagement?.fateCopy?.passages).toContain('engagement');
    expect(dark?.fateCommand?.type).toBe('CONFIRM_ATTACK');
    expect(darkLesson?.fateCopy?.passages).toContain('battlefieldFaceUp');
    expect(plan.steps.indexOf(darkLesson!)).toBeLessThanOrEqual(plan.steps.indexOf(dark!));
    expect(darkLesson?.fateCopy?.passages).toContain('darkTraits');
    expect((dark?.fateCommand?.payload.faceDownIds as string[]).length).toBe(1);
    expect(plan.steps.indexOf(engagement!)).toBeGreaterThan(plan.steps.findIndex(step=>step.fateCommand?.type==='MOVE_PLAYER'));
});


it.each([FATE_TUTORIAL_SEED,FATE_TUTORIAL_SEED.replace(/:r\d+$/,':r11')])('不足8魔力的首次技能教学逐枚手动支付令咒，不能虚报门槛（%s）',seed=>{
    const plan=buildFateTutorialPlan('workshop',seed),ids=['1','0','2'],random=createSeededRandom(seed);
    let state:MatchState<FateDominationCore>={core:FateDominationDomain.setup(ids,random),sys:createInitialSystemState(ids,engineConfig.systems,seed)};
    let completed=false,paid=0;
    for(const [index,command] of plan.commands.entries()){
        const payload=command.payload as {effect?:string;cardIds?:string[]};
        const step=plan.steps.find(step=>step.id===`play-${index+1}`);
        if(command.playerId==='0' && !completed && command.type==='USE_COMMAND_SPELL' && payload.effect==='mana'){
            expect(step?.fateCommand?.type).toBe('USE_COMMAND_SPELL');
            expect(step?.requireAction).toBe(true);
            if(state.core.players['0'].mana+4<8)expect(step?.content).not.toContain('使魔力达到');
            paid++;
        }
        if(command.playerId==='0' && !completed && command.type==='CONFIRM_ATTACK' && payload.cardIds?.some(id=>id.startsWith('sc_iskandar_1'))){
            expect(state.core.players['0'].mana).toBeGreaterThanOrEqual(8);
            completed=true;
        }
        state=executePipeline({domain:FateDominationDomain,systems:engineConfig.systems},state,command,random,ids).state;
    }
    expect(completed).toBe(true);expect(paid).toBeGreaterThan(0);
});
