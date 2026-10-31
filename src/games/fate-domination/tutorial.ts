import type { TutorialManifest, MatchState, Command, TutorialAiAction } from '../../engine/types';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../engine';
import { applyPlayerViewToState } from '../../engine/ai/playerView';
import type { AiDecisionContext } from '../../engine/ai';
import { FateDominationDomain } from './domain';
import type { FateDominationCore, LocationId } from './domain';
import { buildFateAiLegalActions, chooseFateAiAction } from './ai';
import { FATE_SERVANTS } from './data';
import { engineConfig } from './game';
import type { FateTutorialStep } from './ui/tutorialContract';
import { FATE_TUTORIAL_MAP_PROTECTION, FATE_TUTORIAL_TABLE_PROTECTION } from './ui/tutorialPresentation';
import { fateTutorialText, type FateTutorialCopy } from './tutorialText';
import {fateLessonCopy} from './tutorialLessons';
import {describeFateTutorialAction} from './ui/tutorialLessonProjection';
import {resolveFateAttack} from './domain/attackSelection';
import {resolveFateMovement} from './domain/movement';

export const FATE_TUTORIAL_ID = 'fate-domination-foundation';
export const FATE_TUTORIAL_REVISION = 28;
// 与正式页面 buildTutorialProgressSeed 合同一致，测试直接比对。
export const FATE_TUTORIAL_SEED = `tutorial-progress:v1:fate-domination:${FATE_TUTORIAL_ID}:r${FATE_TUTORIAL_REVISION}`;
// 学员排第二顺位：前一席正常占用工房 +2 后，学员能实际选择三个同值 +1 点位。
const ids = ['1', '0', '2'];

/** 先由正式管线复演，再将相同合法命令编成教程，不注入中途局面。 */
export function buildFateTutorialPlan(openingDeploymentLocation:LocationId='workshop', seed=FATE_TUTORIAL_SEED) {
    const random = createSeededRandom(seed);
    let state: MatchState<FateDominationCore> = { core: FateDominationDomain.setup(ids, random), sys: createInitialSystemState(ids, engineConfig.systems, seed) };
    const introCopy: FateTutorialCopy = fateLessonCopy('opening',{text:'你是玩家1，控制韦伯与伊斯坎达尔。玩家2（间桐慎二）和玩家3（言峰绮礼）是由电脑控制的对手。',owner:'FateTutorialSetup'});
    const steps: FateTutorialStep[] = [{ id: 'intro', fateCopy:introCopy, content:fateTutorialText(introCopy), infoStep: true, position: 'center', targetlessPlacement: 'center' }];
    const setupActions: TutorialAiAction[] = [];
    const commands: Command[] = [];
    const taught = new Map<string, string>();
    const taughtAbilities = new Map<string, string>();
    const passageSteps = new Map<string, string>();
    const firstActions = new Map<string, string>();
    let openingDeploymentStepId:string|null=null;
    const add = (command: Command, forceManual = false, commandOptions?:FateTutorialStep['fateCommandOptions']) => {
        const initializeIdentity = command.type === 'SELECT_MASTER' || command.type === 'SELECT_SERVANT';
        const result = executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems }, state, command, random, ids);
        if (!result.success) throw new Error(`Fate教程前因失败：${command.type} ${result.error ?? ''}`);
        const phaseBefore = state.core.phase;
        const text = describeFateTutorialAction(state, command);
        state = result.state;
        commands.push(command);
        if(initializeIdentity){ setupActions.push({commandType:command.type,payload:command.payload,playerId:command.playerId});return; }
        // 阶段和牌源变化本身不构成新教学；他席普通动作由正式牌桌连续呈现。
        const learner = command.playerId === '0';
        const ordinaryOpponentAction = !learner && !['PLAY_SKILL','USE_COMMAND_SPELL','RESOLVE_LOCATION'].includes(command.type) && phaseBefore !== 'preparation';
        if (ordinaryOpponentAction) { text.fateCopy.passages=[]; text.fateCopy.input=undefined; }
        const key = `${learner?'learner':'opponent'}-${text.family}`;
        const id = `play-${commands.length}`;
        const previousPassages=text.fateCopy.passages.map(passage=>passageSteps.get(passage)).filter((value):value is string=>Boolean(value));
        text.fateCopy.passages=text.fateCopy.passages.filter(passage=>!passageSteps.has(passage));
        text.content=fateTutorialText(text.fateCopy);
        const abilityKey=text.fateCopy.ability?JSON.stringify(text.fateCopy.ability):undefined;
        const equivalent = taught.get(key) ?? (!learner&&abilityKey?taughtAbilities.get(abilityKey):undefined) ?? (command.playerId!=='0'&&!text.content ? firstActions.get(command.type) ?? previousPassages[0] : undefined);
        if(learner&&command.type==='USE_COMMAND_SPELL'&&(command.payload as {effect?:string}).effect==='mana'&&equivalent){
            text.fateCopy.input={text:'再使用一枚令咒恢复魔力。',owner:command.type};text.content=fateTutorialText(text.fateCopy);
        }
        if(command.playerId!=='0' && !equivalent && text.content && ['PLAY_SKILL','USE_COMMAND_SPELL'].includes(command.type)){
            text.fateCopy.observer={playerId:command.playerId,masterId:state.core.players[command.playerId].masterId,...(command.type==='PLAY_SKILL'?{abilityName:state.core.players[command.playerId].skills.find(skill=>skill.id===(command.payload as {skillId:string}).skillId)?.name}:command.type==='USE_COMMAND_SPELL'?{abilityName:`令咒·${(command.payload as {effect:string}).effect==='battle'?'强化战斗':(command.payload as {effect:string}).effect==='mana'?'恢复魔力':'移动'}`}:{})};
            text.content=fateTutorialText(text.fateCopy);
        }
        if(command.playerId!=='0'&&command.type==='PASS_ACTION'&&!text.content){
            const previous=steps.at(-1);
            if(previous?.aiActions?.some(action=>action.playerId===command.playerId)&&!previous.advanceOnEvents?.length){
                previous.aiActions=[...previous.aiActions,{commandType:command.type,payload:command.payload,playerId:command.playerId,waitForBoardSyncAfter:true}];
                if(!firstActions.has(command.type))firstActions.set(command.type,previous.id);
                return;
            }
        }
        const manual = command.playerId === '0' && (!equivalent || forceManual);
        const { interactionId: _interactionId, ...response } = command.payload as Record<string, unknown>;
        const authoredPayload = command.type === 'SYS_INTERACTION_RESPOND' || command.type === 'SYS_INTERACTION_CANCEL' ? response : command.payload;
        const step: FateTutorialStep = { id, content: text.content, fateCopy:text.fateCopy, hideActionHint:true, hideOverlay:!text.content, highlightTarget: text.target, position: 'left', showMask: false,
            ...(['fate-map','fate-hand','fate-opponents','fate-master-abilities'].includes(text.target) || command.type === 'DEPLOY_MASTER' ? {highlightFrame:'none' as const}:{}),
            allowedCommands: [command.type], requireAction: manual, allowManualSkip: !manual,
            ...(manual ? { fateCommand: { type: command.type, payload: authoredPayload as Record<string, unknown> }, advanceOnEvents: [{ type: result.events[0].type }] }
                : { aiActions: [{ commandType: command.type, payload: authoredPayload, playerId: command.playerId, waitForBoardSyncAfter: true }], aiDelayMs: equivalent ? 0 : 650 }),
        };
        if (ordinaryOpponentAction) step.advanceOnEvents = [{ type: result.events[0].type }];
        if(command.playerId==='0'&&command.type==='DEPLOY_MASTER'&&!openingDeploymentStepId){
            const copy=fateLessonCopy('deploymentChoice');
            copy.passages=copy.passages.filter(passage=>!passageSteps.has(passage));
            copy.input={text:'这次先去魔术工房补充魔力，选择一个亮起的点位。地图可拖动查看。',owner:'DEPLOY_MASTER'};
            step.fateCopy=copy;step.content=fateTutorialText(copy);step.hideOverlay=false;
            step.highlightTarget='fate-deployment-workshop';step.highlightFrame='none';step.fateCommandOptions=commandOptions;
            step.fateDeploymentChoiceCopies={miyama:fateLessonCopy('battleDeployment'),shinto:fateLessonCopy('battleDeployment')};
            if(openingDeploymentLocation!=='workshop')for(const passage of step.fateDeploymentChoiceCopies[openingDeploymentLocation]?.passages??[])passageSteps.set(passage,id);
            openingDeploymentStepId=id;
            for(const passage of copy.passages)passageSteps.set(passage,id);
        }
        if (!manual && command.playerId !== '0') {
            // 部署时保留命令投影生成的具体合法点位锚点；整张地图作为焦点会把提示压到牌库计数上。
            if (command.type !== 'DEPLOY_MASTER') {
                step.highlightTarget = ['MOVE_PLAYER','RESOLVE_LOCATION'].includes(command.type) ? 'fate-map' : `fate-player-${command.playerId}`;
            }
            step.highlightFrame = 'none';
        }
        if (equivalent && !manual) { step.hiddenAutomation = { kind: 'compressed-repeat', reason: '同一阶段与权限下已实操或观察过的同类命令；新机制保留可见步骤。', equivalentStepIds: [equivalent] }; step.autoAdvanceAfterAi = true; step.content=''; step.fateCopy=undefined; }
        else taught.set(key, id);
        if(abilityKey&&!taughtAbilities.has(abilityKey))taughtAbilities.set(abilityKey,id);
        for(const passage of step.fateCopy?.passages??[])passageSteps.set(passage,id);
        if(!firstActions.has(command.type))firstActions.set(command.type,id);
        steps.push(step);
    };
    const ui = (kind: string, fateCopy: FateTutorialCopy, target: string) => steps.push({ id: `ui-${kind}-${steps.length}`, fateCopy,content:fateTutorialText(fateCopy), hideActionHint:true, highlightTarget: target, highlightFrame:'none', position: 'left', showMask: false, requireAction: true, allowedCommands: [], avoidOverlapSelectors: ['.fd-player-detail', '.fd-runtime-inspection', '.fd-runtime-opponent-cards'] });
    add({ type: 'SELECT_MASTER', playerId: '0', payload: { masterId: 'm_waver' } }, true);
    add({ type: 'SELECT_SERVANT', playerId: '0', payload: { servantId: FATE_SERVANTS.find(servant => servant.trueName === '伊斯坎达尔')!.id } }, true);
    // 第一顺位固定为普通席位；避免将卫宫士郎的首次淘汰例外带进基础课程。
    add({ type: 'SELECT_MASTER', playerId: '1', payload: { masterId: 'm_shinji' } }, true);
    add({ type: 'SELECT_SERVANT', playerId: '1', payload: { servantId: 'servant-heracles' } }, true);
    // 固定他席身份也走正式开局；基础淘汰课不混入首次淘汰豁免的角色例外。
    add({ type: 'SELECT_MASTER', playerId: '2', payload: { masterId: 'm_kirei' } }, true);
    // 本课聚焦基础循环，其他席不用会引入复制等额外能力的默认吉尔伽美什。
    add({ type: 'SELECT_SERVANT', playerId: '2', payload: { servantId: 'servant-saber' } }, true);
    add({ type: 'ADVANCE_PHASE', playerId: ids[0], payload: {} }, true);
    const planned = new Set<string>();
    let publicCardsTaught = false;
    while (!state.sys.gameover && commands.length < 700) {
        const playerId = state.sys.interaction.current?.playerId ?? state.core.currentPlayerId;
        const visibleState = applyPlayerViewToState({gameId:engineConfig.gameId,domain:engineConfig.domain,systems:engineConfig.systems}, state, playerId);
        const legalActions = buildFateAiLegalActions({ playerId, state: visibleState });
        const ctx = { gameId: 'fate-domination', matchId: 'tutorial-plan', playerId, visibleState, legalActions, interaction: null, responseWindow: null, source: 'local' } as AiDecisionContext;
        const first = (key: string, predicate: (type: string, payload: Record<string, unknown>) => boolean) => {
            if (playerId !== '0' || planned.has(key)) return undefined;
            const found = legalActions.find(action => predicate(action.commands[0].type, action.commands[0].payload as Record<string, unknown>));
            if (found) planned.add(key);
            return found;
        };
        const player = state.core.players[playerId];
        const rewardLocations = Object.values(state.core.battlefield).filter(location => location.eventCards.some(card => card.id === 'fuyuki_E12')).map(location => location.id);
        // 学员已为战后选择进入事件地点时，先完成该决策，移动练习留到之后。
        const awaitingReward = playerId === '0' && rewardLocations.includes(player.locationId!) && player.commandSpells < 3;
        const protectFirstRewardResolution=awaitingReward&&state.core.round===2&&player.normalAttackPlayed&&!planned.has('E12-restore');
        const uncontested = playerId==='0' && ['miyama','shinto'].includes(player.locationId??'') && !Object.values(state.core.players).some(other=>other.id!==playerId&&!other.eliminated&&other.locationId===player.locationId);
        // 独占战场不必消耗最强手牌；保留费用与强牌应对之后真正的竞争。
        const economicalAttack = uncontested ? legalActions.filter(action=>action.commands[0].type==='CONFIRM_ATTACK' && !(action.commands[0].payload as {faceDownIds:string[]}).faceDownIds.length).sort((left,right)=>{
            const score=(action:typeof left)=>(action.commands[0].payload as {cardIds:string[]}).cardIds.reduce((sum,id)=>{const card=resolveFateAttack(player,id)?.definition;return sum+(card?.manaCost??0)*100+(card?.basePower??0);},0);
            return score(left)-score(right);
        })[0] : undefined;
        const firstDeployment=playerId==='0'&&!player.locationId&&state.core.phase==='outpost'&&!planned.has('opening-deployment');
        const firstOpponentWorkshopDeployment=playerId==='1'&&!player.locationId&&state.core.phase==='outpost'&&!planned.has('opponent-opening-workshop');
        const opponentWorkshopOpening=firstOpponentWorkshopDeployment
            ? legalActions.find(action=>{const command=action.commands[0],payload=command.payload as {locationId?:string;deploymentSlot?:number};return command.type==='DEPLOY_MASTER'&&payload.locationId==='workshop'&&payload.deploymentSlot===0;})
            : undefined;
        if(firstOpponentWorkshopDeployment&&!opponentWorkshopOpening)throw new Error('Fate教程第一顺位缺少合法工房 +2 部署');
        const chosen = firstDeployment
            ? first('opening-deployment',(type,payload)=>type==='DEPLOY_MASTER'&&payload.locationId===openingDeploymentLocation)
            : opponentWorkshopOpening
            ? opponentWorkshopOpening
            : first(`E12-deploy-${state.core.round}`, (type, payload) => player.commandSpells < 3 && type === 'DEPLOY_MASTER' && rewardLocations.includes(String(payload.locationId) as typeof rewardLocations[number]))
            ?? first('E12-restore', (type, payload) => type === 'SYS_INTERACTION_RESPOND' && payload.optionId === 'restore')
            ?? first('deploy', (type, payload) => type === 'DEPLOY_MASTER' && payload.locationId === 'workshop')
            ?? first('master-draw', (type, payload) => type === 'PLAY_SKILL' && player.masterId==='m_waver' && String(payload.skillId).split(':')[0]==='s2')
            ?? first('normal-move', (type, payload) => type === 'MOVE_PLAYER' && ['miyama','shinto'].includes(String(payload.locationId)))
            ?? (playerId==='0' && !planned.has('skill-attack') && !player.normalAttackPlayed && ['miyama','shinto'].includes(player.locationId??'') && player.mana<8 ? legalActions.find(action=>action.commands[0].type==='USE_COMMAND_SPELL' && (action.commands[0].payload as {effect:string}).effect==='mana') : undefined)
            ?? (playerId==='0' && !planned.has('riding') && !['miyama','shinto'].includes(player.locationId??'') ? legalActions.find(action=>action.commands[0].type==='MOVE_PLAYER' && ['miyama','shinto'].includes(String((action.commands[0].payload as {locationId:string}).locationId))) : undefined)
            ?? first('skill-attack', (type, payload) => ['miyama','shinto'].includes(player.locationId??'') && type === 'CONFIRM_ATTACK' && (payload.cardIds as string[]).some(id => id.startsWith('sc_iskandar_1')))
            ?? first('riding', (type, payload) => ['miyama','shinto'].includes(player.locationId??'') && type === 'PLAY_SKILL' && String(payload.skillId).startsWith('sc_iskandar_1'))
            ?? (!awaitingReward && planned.has('riding') && ['miyama','shinto'].includes(player.locationId??'') ? first('preserve-mana-dark',(type,payload)=>type==='CONFIRM_ATTACK' && (payload.faceDownIds as string[]).length===1 && (payload.faceDownIds as string[]).some(id=>(resolveFateAttack(player,id)?.definition.manaCost??0)>0)) : undefined)
            ?? (awaitingReward ? legalActions.filter(action => action.commands[0].type === 'CONFIRM_ATTACK' && (action.commands[0].payload as {cardIds:string[]}).cardIds.some(id=>id.startsWith('sc_iskandar_1')))
                .sort((left,right)=>{
                    const power=(action:typeof left)=>(action.commands[0].payload as {cardIds:string[]}).cardIds.reduce((sum,id)=>sum+(resolveFateAttack(player,id)?.definition.basePower??0),0);
                    return power(right)-power(left);
                })[0] : undefined)
            ?? (awaitingReward ? legalActions.find(action => action.commands[0].type === 'PLAY_SKILL' && String((action.commands[0].payload as {skillId:string}).skillId).startsWith('sc_iskandar_1')) : undefined)
            // 争取恢复令咒时，保留技能攻击的8魔力门槛，不为额外抽牌先付掉最后1点。
            ?? (awaitingReward && state.core.phase === 'outpost' && player.mana === 8 && !player.commandSpells ? legalActions.find(action => action.commands[0].type === 'ADVANCE_PHASE') : undefined)
            ?? (awaitingReward && !player.normalAttackPlayed && player.mana<8 ? legalActions.find(action=>action.commands[0].type==='USE_COMMAND_SPELL'&&(action.commands[0].payload as {effect:string}).effect==='mana') : undefined)
            ?? economicalAttack
            // 留在 E12 战场直到首次实际获得战后令咒选择，避免教程在结算前用令咒移动离场。
            ?? (protectFirstRewardResolution ? legalActions.find(action=>action.commands[0].type==='PASS_ACTION') : undefined)
            // 学员保留令咒应付真正的费用缺口和事件战场，不为每次小幅威力增量消耗。
            ?? legalActions.find(action => action.actionId === chooseFateAiAction(playerId==='0'&&!awaitingReward?{...ctx,legalActions:legalActions.filter(action=>action.commands[0].type!=='USE_COMMAND_SPELL' && !(!['miyama','shinto'].includes(player.locationId??'') && action.commands[0].type==='PLAY_SKILL' && String((action.commands[0].payload as {skillId?:string}).skillId).startsWith('sc_iskandar_1')))}:ctx)?.actionId);
        if (!chosen) throw new Error(`Fate教程缺合法动作：${state.core.round}/${state.core.phase}/${playerId}`);
        if(firstOpponentWorkshopDeployment)planned.add('opponent-opening-workshop');
        const command=chosen.commands[0];
        if(playerId==='0' && command.type==='PLAY_SKILL' && String((command.payload as {skillId?:string}).skillId).split(':')[0]==='s2' && !planned.has('master-reading')){
            planned.add('master-reading');
            ui('detail',fateLessonCopy('masterReading',{text:'先点左下角的韦伯头像，查看“战略部署”；再点御主卡放大阅读，读完返回牌桌使用能力。',owner:'FateSelfDock'}),'fate-self-avatar');
            steps[steps.length-1].fateUiDetailTarget='0';
            steps[steps.length-1].highlightFrame=undefined;
        }
        const isOpeningDeployment=firstDeployment&&command.type==='DEPLOY_MASTER';
        const deploymentOptions=isOpeningDeployment?legalActions.flatMap(action=>action.commands).filter(candidate=>candidate.type==='DEPLOY_MASTER').map(candidate=>({type:candidate.type,payload:candidate.payload as Record<string,unknown>})):undefined;
        if (!publicCardsTaught && playerId === '0' && state.core.phase === 'battle') {
            ui('public-cards', fateLessonCopy('publicPower',{text:'悬停对手头像查看已打出的牌；触控可点玩家摘要展开。',owner:'FatePlayerRail'}), 'fate-opponents');
            publicCardsTaught = true;
        }
        if(playerId==='0' && ['USE_COMMAND_SPELL','CONFIRM_ATTACK'].includes(chosen.commands[0].type) && !planned.has('card-reading')){
            const riding=player.skills.find(skill=>skill.id.startsWith('sc_iskandar_1'));
            if(!riding)throw new Error('固定教程从者缺少首次读卡的骑乘牌');
            planned.add('card-reading');ui('inspection',fateLessonCopy('cardReading',{text:'长按或右键检视“骑乘”。手牌较多时可横向滚动。',owner:'FateHandSurface'}),`fate-card-${riding.id}`);
            steps[steps.length-1].fateUiInspectionSource='hand';
        }
        if (playerId === '0' && player.discard.length && !planned.has('nonempty-discard')) {
            ui('pile', fateLessonCopy('discard'), 'fate-self');
            planned.add('nonempty-discard');
        }
        const revealedPeer=Object.values(state.core.players).find(other=>other.id!=='0'&&other.isRevealed);
        if (playerId === '0' && state.core.phase === 'battle' && revealedPeer && !planned.has('revealed-detail')) {
            const fateCopy:FateTutorialCopy=fateLessonCopy('revelation');
            fateCopy.observer={playerId:revealedPeer.id,masterId:revealedPeer.masterId};
            steps.push({id:'revelation-observe',fateCopy,content:fateTutorialText(fateCopy),highlightTarget:`fate-player-${revealedPeer.id}`,highlightFrame:'none',position:'left',infoStep:true,showMask:false});
            planned.add('revealed-detail');
        }
        const manualManaPayment=playerId==='0' && !planned.has('skill-attack') && command.type==='USE_COMMAND_SPELL' && (command.payload as {effect?:string}).effect==='mana';
        add({ ...command, playerId },manualManaPayment,deploymentOptions);
        if(playerId==='0' && command.type==='MOVE_PLAYER' && !planned.has('engagement') && resolveFateMovement(state.core,'0','recon').failures.some(failure=>failure.code==='engaged')){
            planned.add('engagement');const fateCopy=fateLessonCopy('engagement');
            steps.push({id:'engagement-observe',fateCopy,content:fateTutorialText(fateCopy),highlightTarget:'fate-map',highlightFrame:'none',position:'left',showMask:false,infoStep:true});
        }
        if (!state.sys.gameover && !planned.has('elimination-ui')) {
            const eliminated = Object.values(state.core.players).find(player=>player.eliminated);
            if (eliminated) {
                planned.add('elimination-ui');
                const fateCopy:FateTutorialCopy=fateLessonCopy('elimination');
                steps.push({id:'elimination-observe',fateCopy,content:fateTutorialText(fateCopy),highlightTarget:eliminated.id==='0'?'fate-self':`fate-player-${eliminated.id}`,highlightFrame:'none',position:'left',infoStep:true,showMask:false});
            }
        }
    }
    if (!state.sys.gameover) throw new Error('Fate教程自然链没有收口');
    const openingDeploymentIndex=openingDeploymentStepId?steps.findIndex(step=>step.id===openingDeploymentStepId):-1;
    if(openingDeploymentIndex<0)throw new Error('Fate教程未生成首次部署选择');
    for(const step of steps.slice(openingDeploymentIndex+1))step.branch=openingDeploymentLocation;
    steps.unshift({id:'setup',content:'',aiActions:setupActions,hiddenAutomation:{kind:'setup-precondition',reason:'首张可见课程前通过正式命令设定固定学员身份；不预做部署、移动、支付或出牌。'},autoAdvanceAfterAi:true,aiDelayMs:0});
    const seenPassages = new Set<string>();
    for(const step of steps){
        // 说明、交互与观察共用首次教学记录，避免插入的 UI 步骤漏出同一规则。
        if (step.fateCopy) {
            step.fateCopy.passages = step.fateCopy.passages.filter(passage => {
                if (seenPassages.has(passage)) return false;
                seenPassages.add(passage); return true;
            });
            step.content = fateTutorialText(step.fateCopy);
            step.hideOverlay = !step.content;
        }
        step.tooltipMaxWidth=step.fateCopy?.lessonId==='battlefieldDarkAttack'?384:320;
        // 手牌规则不需要保护未被讲解的地图印刷底图；卡、棋子、读数与席位始终保护。
        // 急行来源课还要读地图箭头和目的地，保留其地图保护。
        const mapStep=Boolean(step.highlightTarget)&&(step.highlightTarget!=='fate-hand'||step.fateCopy?.lessonId==='actionAbility');
        step.avoidOverlapSelectors=[...FATE_TUTORIAL_TABLE_PROTECTION,...(mapStep?FATE_TUTORIAL_MAP_PROTECTION:[])];
    }
    return { steps, commands, finalState: state };
}

const plan = buildFateTutorialPlan();
const alternativeDeploymentPlans=[buildFateTutorialPlan('miyama'),buildFateTutorialPlan('shinto')];
const deploymentStepIndex=plan.steps.findIndex(step=>step.fateCommand?.type==='DEPLOY_MASTER');
if(deploymentStepIndex<0||alternativeDeploymentPlans.some(candidate=>candidate.steps[deploymentStepIndex]?.id!==plan.steps[deploymentStepIndex]?.id))throw new Error('Fate教程部署分支前序不一致');
const namespacedBranch=(steps:FateTutorialStep[],prefix:string)=>{
    const branch=steps.slice(deploymentStepIndex+1);
    const ids=new Map(branch.map(step=>[step.id,`${prefix}-${step.id}`]));
    return branch.map(step=>{
        const hiddenAutomation=step.hiddenAutomation;
        return {
            ...step,
            id:ids.get(step.id)!,
            hiddenAutomation:hiddenAutomation?.kind==='compressed-repeat'&&hiddenAutomation.equivalentStepIds
                ? {...hiddenAutomation,equivalentStepIds:hiddenAutomation.equivalentStepIds.map(id=>ids.get(id)??id)}
                : hiddenAutomation,
        };
    });
};
const tutorialSteps=[...plan.steps.slice(0,deploymentStepIndex+1),...plan.steps.slice(deploymentStepIndex+1),...namespacedBranch(alternativeDeploymentPlans[0].steps,'miyama'),...namespacedBranch(alternativeDeploymentPlans[1].steps,'shinto')];
export const FateDominationTutorial: TutorialManifest = {
    id: FATE_TUTORIAL_ID, playerId: '0', revision: FATE_TUTORIAL_REVISION, numPlayers: 3, stayOnMatchAfterCompletion: true, closeOnGameOver:true, steps: tutorialSteps,
    selectBranch:(_state,rawStep,command)=>{
        const options=(rawStep as FateTutorialStep).fateCommandOptions;
        if(command.type!=='DEPLOY_MASTER'||command.playerId!=='0'||!options?.length)return undefined;
        const payload=command.payload as {locationId?:unknown;deploymentSlot?:unknown};
        const selected=options.find(option=>option.type===command.type&&option.payload.locationId===payload.locationId&&option.payload.deploymentSlot===payload.deploymentSlot);
        return selected?String(payload.locationId):undefined;
    },
};
export default FateDominationTutorial;
