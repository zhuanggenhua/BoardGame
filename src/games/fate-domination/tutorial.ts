import type { TutorialManifest, MatchState, Command, TutorialAiAction } from '../../engine/types';
import { createInitialSystemState, createSeededRandom, executePipeline } from '../../engine';
import { applyPlayerViewToState } from '../../engine/ai/playerView';
import type { AiDecisionContext } from '../../engine/ai';
import { FateDominationDomain } from './domain';
import type { FateDominationCore } from './domain';
import { buildFateAiLegalActions, chooseFateAiAction } from './ai';
import { FATE_SERVANTS } from './data';
import { engineConfig } from './game';
import type { FateTutorialStep } from './ui/tutorialContract';
import { FATE_TUTORIAL_TABLE_PROTECTION } from './ui/tutorialPresentation';
import { fateTutorialText, type FateTutorialCopy } from './tutorialText';
import {fateLessonCopy} from './tutorialLessons';
import {describeFateTutorialAction} from './ui/tutorialLessonProjection';
import {resolveFateAttack} from './domain/attackSelection';

export const FATE_TUTORIAL_ID = 'fate-domination-foundation';
export const FATE_TUTORIAL_REVISION = 5;
// 与正式页面 buildTutorialProgressSeed 合同一致，测试直接比对。
export const FATE_TUTORIAL_SEED = `tutorial-progress:v1:fate-domination:${FATE_TUTORIAL_ID}:r${FATE_TUTORIAL_REVISION}`;
const ids = ['0', '1', '2'];

/** 先由正式管线复演，再将相同合法命令编成教程，不注入中途局面。 */
export function buildFateTutorialPlan() {
    const random = createSeededRandom(FATE_TUTORIAL_SEED);
    let state: MatchState<FateDominationCore> = { core: FateDominationDomain.setup(ids, random), sys: createInitialSystemState(ids, engineConfig.systems, FATE_TUTORIAL_SEED) };
    const introCopy: FateTutorialCopy = fateLessonCopy('opening');
    const steps: FateTutorialStep[] = [{ id: 'intro', fateCopy:introCopy, content:fateTutorialText(introCopy), infoStep: true, position: 'center', targetlessPlacement: 'center' }];
    const setupActions: TutorialAiAction[] = [];
    const commands: Command[] = [];
    const taught = new Map<string, string>();
    const passageSteps = new Map<string, string>();
    const firstActions = new Map<string, string>();
    const add = (command: Command, forceManual = false) => {
        const initializeIdentity = command.type === 'SELECT_MASTER' || command.type === 'SELECT_SERVANT';
        const result = executePipeline({ domain: FateDominationDomain, systems: engineConfig.systems }, state, command, random, ids);
        if (!result.success) throw new Error(`Fate教程前因失败：${command.type} ${result.error ?? ''}`);
        const text = describeFateTutorialAction(state, command);
        state = result.state;
        commands.push(command);
        if(initializeIdentity){ setupActions.push({commandType:command.type,payload:command.payload,playerId:command.playerId});return; }
        const key = `${command.playerId==='0'?'learner':'opponent'}-${text.family}`;
        const id = `play-${commands.length}`;
        const previousPassages=text.fateCopy.passages.map(passage=>passageSteps.get(passage)).filter((value):value is string=>Boolean(value));
        text.fateCopy.passages=text.fateCopy.passages.filter(passage=>!passageSteps.has(passage));
        text.content=fateTutorialText(text.fateCopy);
        const equivalent = taught.get(key) ?? (command.playerId!=='0'&&!text.content ? firstActions.get(command.type) ?? previousPassages[0] : undefined);
        if(command.playerId!=='0' && !equivalent && text.content){
            text.fateCopy.observer={playerId:command.playerId,...(command.type==='PLAY_SKILL'?{abilityName:state.core.players[command.playerId].skills.find(skill=>skill.id===(command.payload as {skillId:string}).skillId)?.name}:{})};
            text.content=fateTutorialText(text.fateCopy);
        }
        const manual = command.playerId === '0' && (!equivalent || forceManual);
        const { interactionId: _interactionId, ...response } = command.payload as Record<string, unknown>;
        const authoredPayload = command.type === 'SYS_INTERACTION_RESPOND' || command.type === 'SYS_INTERACTION_CANCEL' ? response : command.payload;
        const step: FateTutorialStep = { id, content: text.content, fateCopy:text.fateCopy, hideActionHint:true, hideOverlay:!text.content, highlightTarget: text.target, position: 'left', showMask: false,
            ...(['fate-map','fate-hand','fate-opponents'].includes(text.target) || command.type === 'DEPLOY_MASTER' ? {highlightFrame:'none' as const}:{}),
            allowedCommands: [command.type], requireAction: manual, allowManualSkip: !manual,
            ...(manual ? { fateCommand: { type: command.type, payload: authoredPayload as Record<string, unknown> }, advanceOnEvents: [{ type: result.events[0].type }] }
                : { aiActions: [{ commandType: command.type, payload: authoredPayload, playerId: command.playerId, waitForBoardSyncAfter: true }], aiDelayMs: equivalent ? 0 : 650 }),
        };
        if (!manual && command.playerId !== '0') {
            step.highlightTarget = ['DEPLOY_MASTER','MOVE_PLAYER','RESOLVE_LOCATION'].includes(command.type) ? 'fate-map' : 'fate-opponents';
            step.highlightFrame = 'none';
        }
        if (equivalent && !manual) { step.hiddenAutomation = { kind: 'compressed-repeat', reason: '同一阶段与权限下已实操或观察过的同类命令；新机制保留可见步骤。', equivalentStepIds: [equivalent] }; step.autoAdvanceAfterAi = true; step.content=''; step.fateCopy=undefined; }
        else taught.set(key, id);
        for(const passage of text.fateCopy.passages)passageSteps.set(passage,id);
        if(!firstActions.has(command.type))firstActions.set(command.type,id);
        steps.push(step);
    };
    const ui = (kind: string, fateCopy: FateTutorialCopy, target: string) => steps.push({ id: `ui-${kind}-${steps.length}`, fateCopy,content:fateTutorialText(fateCopy), hideActionHint:true, highlightTarget: target, highlightFrame:'none', position: 'left', showMask: false, requireAction: true, allowedCommands: [], avoidOverlapSelectors: ['.fd-player-detail', '.fd-runtime-inspection', '.fd-runtime-opponent-cards'] });
    add({ type: 'SELECT_MASTER', playerId: '0', payload: { masterId: 'm_waver' } }, true);
    add({ type: 'SELECT_SERVANT', playerId: '0', payload: { servantId: FATE_SERVANTS.find(servant => servant.trueName === '伊斯坎达尔')!.id } }, true);
    // 固定他席身份也走正式开局；基础淘汰课不混入首次淘汰豁免的角色例外。
    add({ type: 'SELECT_MASTER', playerId: '2', payload: { masterId: 'm_kirei' } }, true);
    // 本课聚焦基础循环，其他席不用会引入复制等额外能力的默认吉尔伽美什。
    add({ type: 'SELECT_SERVANT', playerId: '2', payload: { servantId: 'servant-saber' } }, true);
    add({ type: 'ADVANCE_PHASE', playerId: '0', payload: {} }, true);
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
        const uncontested = playerId==='0' && ['miyama','shinto'].includes(player.locationId??'') && !Object.values(state.core.players).some(other=>other.id!==playerId&&!other.eliminated&&other.locationId===player.locationId);
        // 独占战场不必消耗最强手牌；保留费用与强牌应对之后真正的竞争。
        const economicalAttack = uncontested ? legalActions.filter(action=>action.commands[0].type==='CONFIRM_ATTACK' && !(action.commands[0].payload as {faceDownIds:string[]}).faceDownIds.length).sort((left,right)=>{
            const score=(action:typeof left)=>(action.commands[0].payload as {cardIds:string[]}).cardIds.reduce((sum,id)=>{const card=resolveFateAttack(player,id)?.definition;return sum+(card?.manaCost??0)*100+(card?.basePower??0);},0);
            return score(left)-score(right);
        })[0] : undefined;
        const chosen = first(`E12-deploy-${state.core.round}`, (type, payload) => player.commandSpells < 3 && type === 'DEPLOY_MASTER' && rewardLocations.includes(String(payload.locationId) as typeof rewardLocations[number]))
            ?? first('E12-restore', (type, payload) => type === 'SYS_INTERACTION_RESPOND' && payload.optionId === 'restore')
            ?? first('deploy', (type, payload) => type === 'DEPLOY_MASTER' && payload.locationId === 'workshop')
            ?? first('master-draw', (type, payload) => type === 'PLAY_SKILL' && String(payload.skillId).startsWith('m_waver_s2'))
            ?? first('normal-move', (type, payload) => type === 'MOVE_PLAYER' && payload.locationId === 'miyama')
            ?? first('seal-mana', (type, payload) => type === 'USE_COMMAND_SPELL' && payload.effect === 'mana' && player.mana < 8)
            ?? first('skill-attack', (type, payload) => type === 'CONFIRM_ATTACK' && (payload.cardIds as string[]).some(id => id.startsWith('sc_iskandar_1')))
            ?? first('riding', (type, payload) => type === 'PLAY_SKILL' && String(payload.skillId).startsWith('sc_iskandar_1'))
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
            // 学员保留令咒应付真正的费用缺口和事件战场，不为每次小幅威力增量消耗。
            ?? legalActions.find(action => action.actionId === chooseFateAiAction(playerId==='0'&&!awaitingReward?{...ctx,legalActions:legalActions.filter(action=>action.commands[0].type!=='USE_COMMAND_SPELL')}:ctx)?.actionId);
        if (!chosen) throw new Error(`Fate教程缺合法动作：${state.core.round}/${state.core.phase}/${playerId}`);
        if (!publicCardsTaught && playerId === '0' && state.core.phase === 'battle') {
            ui('public-cards', fateLessonCopy('publicPower',{text:'悬停对手头像查看已打出的牌；触控可点玩家摘要展开。',owner:'FatePlayerRail'}), 'fate-opponents');
            publicCardsTaught = true;
        }
        if(playerId==='0' && ['USE_COMMAND_SPELL','CONFIRM_ATTACK'].includes(chosen.commands[0].type) && !planned.has('card-reading')){
            planned.add('card-reading');ui('inspection',fateLessonCopy('cardReading',{text:'长按或右键检视骑乘。',owner:'FateHandSurface'}),'fate-skills');
            steps[steps.length-1].fateUiInspectionSource='hand';
        }
        if(playerId==='0' && chosen.commands[0].type==='MOVE_PLAYER' && !planned.has('map-camera')){
            planned.add('map-camera');
            const cameraCopy:FateTutorialCopy=fateLessonCopy('navigation',{text:'拖动地图、滚轮缩放；点局势或事件牌可检视。',owner:'FateMapSurface'});
            steps.push({id:'map-camera',fateCopy:cameraCopy,content:fateTutorialText(cameraCopy),highlightTarget:'fate-map',highlightFrame:'none',position:'left',infoStep:true,showMask:false});
        }
        if (playerId === '0' && player.discard.length && !planned.has('nonempty-discard')) {
            ui('pile', fateLessonCopy('discard'), 'fate-self');
            planned.add('nonempty-discard');
        }
        const revealedPeer=Object.values(state.core.players).find(other=>other.id!=='0'&&other.isRevealed);
        if (playerId === '0' && state.core.phase === 'battle' && revealedPeer && !planned.has('revealed-detail')) {
            const fateCopy:FateTutorialCopy=fateLessonCopy('revelation');
            fateCopy.observer={playerId:revealedPeer.id};
            steps.push({id:'revelation-observe',fateCopy,content:fateTutorialText(fateCopy),highlightTarget:'fate-opponents',highlightFrame:'none',position:'left',infoStep:true,showMask:false});
            planned.add('revealed-detail');
        }
        const previousRound=state.core.round;
        add({ ...chosen.commands[0], playerId });
        if(state.core.round!==previousRound && !planned.has('round-return')){
            planned.add('round-return');const fateCopy=fateLessonCopy('roundReturn');
            steps.push({id:'round-return-observe',fateCopy,content:fateTutorialText(fateCopy),highlightTarget:'fate-hand',highlightFrame:'none',position:'left',showMask:false,infoStep:true});
        }
        if (!state.sys.gameover && !planned.has('elimination-ui')) {
            const eliminated = Object.values(state.core.players).find(player=>player.eliminated);
            if (eliminated) {
                planned.add('elimination-ui');
                const fateCopy:FateTutorialCopy=fateLessonCopy('elimination');
                steps.push({id:'elimination-observe',fateCopy,content:fateTutorialText(fateCopy),highlightTarget:eliminated.id==='0'?'fate-self':'fate-opponents',highlightFrame:'none',position:'left',infoStep:true,showMask:false});
            }
        }
        if (playerId === '0' && chosen.commands[0].type === 'DEPLOY_MASTER' && !planned.has('first-deployment')) {
            planned.add('first-deployment');
            const fateCopy:FateTutorialCopy=fateLessonCopy('outpost');
            steps.push({id:'first-deployment-result',fateCopy,content:fateTutorialText(fateCopy),highlightTarget:'fate-pawn-0',highlightFrame:'none',position:'left',infoStep:true,showMask:false});
        }
    }
    if (!state.sys.gameover) throw new Error('Fate教程自然链没有收口');
    steps.unshift({id:'setup',content:'',aiActions:setupActions,hiddenAutomation:{kind:'setup-precondition',reason:'首张可见课程前通过正式命令设定固定学员身份；不预做部署、移动、支付或出牌。'},autoAdvanceAfterAi:true,aiDelayMs:0});
    for(const step of steps)step.avoidOverlapSelectors=[...FATE_TUTORIAL_TABLE_PROTECTION];
    return { steps, commands, finalState: state };
}

const plan = buildFateTutorialPlan();
export const FateDominationTutorial: TutorialManifest = { id: FATE_TUTORIAL_ID, playerId: '0', revision: FATE_TUTORIAL_REVISION, numPlayers: 3, stayOnMatchAfterCompletion: true, steps: plan.steps };
export default FateDominationTutorial;
