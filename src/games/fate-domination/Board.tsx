import { useTutorialBridge } from '../../contexts/TutorialContext';
import { FateTutorialUiBridge, type FateInspectionSource } from './ui/FateTutorialUiBridge';
import { fateTutorialAllows, fateTutorialExpected } from './ui/tutorialContract';
import { presentFateTutorial } from './ui/tutorialPresentation';
import { FateIdentitySetup } from './ui/FateIdentitySetup';
import { UI_Z_INDEX } from '../../core/ui/zIndex';
import { useFateDeploymentInteraction } from './ui/useFateDeploymentInteraction';
import {useFateAttackDraft} from './ui/useFateAttackDraft';
import { FatePostBattleChoice } from './ui/FatePostBattleChoice';
import { FateEndgame } from './ui/FateEndgame';
import { useEndgame } from '../../hooks/game/useEndgame';
import { isFatePostBattleChoice } from './domain/postBattleChoice';
import { isFateRidingChoice } from './domain/ridingChoice';
import { visibleFatePower } from './domain/playerView';
import {CardPreview} from '../../components/common/media/CardPreview';
import {fateCardPreview} from './data/cardArtwork';
import './ui/identityArtwork';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GameBoardProps } from '../../engine/transport/protocol';
import type { MatchState } from '../../engine/types';
import { UndoProvider } from '../../contexts/UndoContext';
import { FATE_SERVANT_BY_ID } from './data';
import { FATE_BATTLE_LOCATION_ORDER } from './domain';
import type { FateDominationCommandMap, FateDominationCommand, FateDominationCore, LocationId } from './domain';
import { calculateFatePower } from './domain/power';
import { validate } from './domain/commands';
import {resolveFateAbilityDefinition,resolveFatePlayerAbility} from './domain/abilityRegistry';
import {projectFateSkillCards} from './domain/playerView';
import {hasLegalFateNormalPlay} from './domain/attackSelection';
import {useFateMovementInteraction} from './ui/useFateMovementInteraction';
import { FateMapSurface } from './ui/FateMapSurface';
import { FateHandSurface, type FateSkillCardView } from './ui/FateHandSurface';
import { FatePlayerDetail } from './ui/FatePlayerDetail';
import { FateCommandSpellChoice } from './ui/FateCommandSpellChoice';
import { useFateAbilityFeedback } from './ui/useFateAbilityFeedback';
import { FateSelfDock } from './ui/FateSelfDock';
import {FateDiscardInspection} from './ui/FateDiscardInspection';
import { FatePlayerRail } from './ui/FatePlayerRail';
import { servantSkillsFor } from './ui/playerPresentation';
import './ui/runtime-table.css';
import { placeFateInspection } from './ui/inspectionPlacement';
type Props = GameBoardProps<FateDominationCore, FateDominationCommandMap>;
type Inspection = {
    asset: string;
    name: string;
    pinned: boolean;
    source: FateInspectionSource;
};
export const FateDominationBoard: React.FC<Props> = ({ G, dispatch, playerID, matchData, isMultiplayer, isConnected, reset }) => {
    const { t, i18n } = useTranslation('game-fate-domination');
    const actorId = playerID ?? (isMultiplayer ? null : G.core.currentPlayerId);
    const expectedTutorialCommand = fateTutorialExpected(G.sys.tutorial);
    const send = (type: string, payload: unknown) => {
        if (fateTutorialAllows(G.sys.tutorial, type, payload)) (dispatch as (type: string, payload: unknown) => void)(type, payload);
        else if (expectedTutorialCommand) (dispatch as (type: string, payload: unknown) => void)('SYS_TUTORIAL_RESTART_STEP', {});
    };
    const attackDraft = useFateAttackDraft(G,actorId,send,!isMultiplayer || isConnected!==false);
    const core = attackDraft.state.core;
    const { overlayProps: endgameProps } = useEndgame({ result: G.sys.gameover, playerID: isMultiplayer ? playerID : null, reset, matchData, isMultiplayer });
    const postBattleChoice = isFatePostBattleChoice(G.sys.interaction.current) ? G.sys.interaction.current : undefined;
    const ridingChoice = isFateRidingChoice(G.sys.interaction.current) ? G.sys.interaction.current : undefined;
    const interactionBlocked=Boolean(G.sys.interaction.current || G.sys.interaction.queue.length);
    const actor = actorId ? core.players[actorId] : undefined;
    const current = Boolean(actor && actorId === core.currentPlayerId);
    const playedCardCount = actor ? new Set([...actor.activeAttackIds, ...actor.activeSkills, ...actor.selectedAttackIds]).size : 0;
    useFateAbilityFeedback(core, actorId, G.sys?.eventStream?.entries);
    const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
    const publicCardsOpen=Boolean(selectedSeat && selectedSeat!==actorId && core.players[selectedSeat]);
    const [detail, setDetail] = useState<string | null>(null);
    const [inspection, setInspection] = useState<Inspection | null>(null);
    const [inspectionPosition, setInspectionPosition] = useState<React.CSSProperties>({left:16,top:90});
    const movement = useFateMovementInteraction(attackDraft.state, actorId);
    const deployment = useFateDeploymentInteraction(attackDraft.state, actorId);
    const [usingSeal, setUsingSeal] = useState(false);
    const [pile, setPile] = useState<'deck' | 'discard' | null>(null);
    const [ridingSelectionCount,setRidingSelectionCount]=useState(0);
    const tutorialDisplay = React.useMemo(() => presentFateTutorial(G.sys.tutorial, {
        inspection: inspection?.pinned ? inspection : null, detail, viewerId:actorId, detailEliminated: Boolean(detail && core.players[detail]?.eliminated), seal: usingSeal, discard: pile === 'discard' && Boolean(actor?.discard.length),
        movement: Boolean(movement.intent), movementTarget: Boolean(movement.target), postBattle:Boolean(postBattleChoice), attackStaged:Boolean(actor?.selectedAttackIds.length), ridingSelectionCount, publicCards:publicCardsOpen,
        identity: core.phase === 'preparation' && core.round === 1 && Boolean(actorId && !(core.phaseCompletedPlayerIds ?? []).includes(actorId)),
    }), [G.sys.tutorial, inspection, detail, core.players, usingSeal, pile, actor?.discard.length, actor?.selectedAttackIds.length, movement.intent, movement.target, postBattleChoice, ridingSelectionCount, publicCardsOpen, core.phase, core.round, actorId, core.phaseCompletedPlayerIds]);
    useTutorialBridge(tutorialDisplay, dispatch as (type: string, payload?: unknown) => void, `${G.sys.eventStream.nextId}:${G.sys.undo.rollbackRevision ?? 0}:${tutorialDisplay.step?.highlightTarget}:${tutorialDisplay.step?.content}`);
    React.useEffect(() => { setUsingSeal(false); setInspection(null); setDetail(null); setPile(null); if (G.sys.tutorial.active) setSelectedSeat(null); }, [actorId, core.currentPlayerId, core.phase, G.sys.interaction.current?.id, G.sys.tutorial.active ? `${G.sys.tutorial.step?.id}:${G.sys.undo.rollbackRevision}` : undefined]);
    const inspectionSource = React.useRef<HTMLElement | null>(null);
    const inspectionBackdropPress = React.useRef(false);
    const inspectionCloseButton = React.useRef<HTMLButtonElement>(null);
    const restoreInspectionFocus = React.useRef(false);
    const suppressRestoredFocusPreview = React.useRef(false);
    const inspect = (asset: string, name: string, pinned = true, source: FateInspectionSource = 'hand') => {
        inspectionBackdropPress.current = false;
        if (pinned) inspectionSource.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setInspection({ asset, name, pinned, source });
    };
    const dismissHoverInspection = () => setInspection(current => current && !current.pinned ? null : current);
    const dismissInspection = () => {
        if (inspection?.pinned) restoreInspectionFocus.current = true;
        setInspection(null);
    };
    React.useLayoutEffect(() => {
        if (inspection?.pinned) {
            inspectionCloseButton.current?.focus({preventScroll:true});
            return;
        }
        if (!inspection && restoreInspectionFocus.current) {
            restoreInspectionFocus.current = false;
            suppressRestoredFocusPreview.current = true;
            try { inspectionSource.current?.focus({preventScroll:true}); }
            finally { suppressRestoredFocusPreview.current = false; }
        }
    }, [inspection]);
    React.useEffect(() => {
        if (!inspection) return;
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault(); event.stopPropagation(); dismissInspection();
        };
        window.addEventListener('keydown', closeOnEscape, true);
        return () => window.removeEventListener('keydown', closeOnEscape, true);
    }, [inspection]);
    React.useLayoutEffect(() => {
        if (!inspection || inspection.pinned) return;
        const position = () => setInspectionPosition(placeFateInspection(
            {width:window.innerWidth,height:window.innerHeight},
            Array.from(document.querySelectorAll('.fd-runtime-hand-grid .fd-runtime-card, .fd-runtime-opponent-cards, .fd-runtime-player-rail'))
                .map(element => element.getBoundingClientRect())
        ));
        position(); window.addEventListener('resize', position);
        return () => window.removeEventListener('resize', position);
    }, [inspection, selectedSeat]);
    const nameFor = (id: string) => matchData?.find(item => String(item.id) === id)?.name ?? `玩家 ${Number(id) + 1}`;
    const abilityAvailable=(id:string,sourceId:string)=>!interactionBlocked&&current&&id===actorId&&(resolveFatePlayerAbility(core,id,sourceId)?.effects.some(effect=>effect.type==='movement')?movement.legalTargets({kind:'skill',skillId:sourceId}).length>0:validate(attackDraft.state,{type:'PLAY_SKILL',playerId:id,payload:{skillId:sourceId}}).valid);
    const activateAbility = (skillId: string) => {
        if (!actorId || !abilityAvailable(actorId, skillId)) return;
        setInspection(null);
        setDetail(null);
        const ability = resolveFatePlayerAbility(core, actorId, skillId);
        if (ability?.effects.some(effect => effect.type === 'riding')) {
            movement.cancel();
            send('PLAY_SKILL', {skillId});
        } else if (ability?.effects.some(effect => effect.type === 'movement'))
            movement.begin({kind:'skill',skillId});
        else send('PLAY_SKILL', {skillId});
    };
    const skillCards = (id: string): FateSkillCardView[] => {
        const player = core.players[id];
        const servant = FATE_SERVANT_BY_ID[player.servantId];
        if (id !== actorId) return projectFateSkillCards(player, actorId).map((card,index)=>({
            skill:{id:card?.id??`hidden-${index}`,name:card?.name??'暗置技能'},
            assetPath:card?.assetPath??'fate-domination/backs/skill',available:false,abilityAvailable:false,
        }));
        return servantSkillsFor(player).map(({ skill, index }) => ({ skill, assetPath: servant.skillAssetPaths[index],
            available: id===actorId && attackDraft.canSelect(skill.id),
            abilityAvailable: abilityAvailable(id,skill.id) }));
    };
    const targets = interactionBlocked ? [] : movement.intent ? movement.targets : deployment.targets;
    const nextLocation = FATE_BATTLE_LOCATION_ORDER.find(id => !core.resolvedLocations.includes(id));
    const phasePrimary: FateDominationCommand = core.phase === 'action'
        ? actor?.selectedAttackIds.length
            ? { type: 'CONFIRM_ATTACK', playerId: actorId ?? '', payload: attackDraft.payload }
            : { type: 'PASS_ACTION', playerId: actorId ?? '', payload: {} }
        : core.phase === 'battle' && core.battleResolution?.step === 'locations' && nextLocation
            ? { type: 'RESOLVE_LOCATION', playerId: actorId ?? '', payload: { locationId: nextLocation } }
            : { type: 'ADVANCE_PHASE', playerId: actorId ?? '', payload: {} };
    const primary = movement.command ?? deployment.command ?? phasePrimary;
    const primaryLabel = movement.intent ? (movement.target ? `确认移动至${core.battlefield[movement.target].label}` : '选择移动目标') : core.phase === 'action' ? (actor?.selectedAttackIds.length ? '确认攻击' : actor && !actor.normalAttackPlayed && hasLegalFateNormalPlay(core,actor.id) ? '选择两张攻击' : '结束行动') : core.phase === 'preparation' ? '完成准备' : core.phase === 'outpost' ? (deployment.target ? `确认部署至${core.battlefield[deployment.target].label}` : !actor?.locationId ? '选择部署点位' : '结束我的前哨阶段') : primary.type === 'RESOLVE_LOCATION' && nextLocation ? `结算${core.battlefield[nextLocation].label}` : core.phase === 'battle' ? (core.battleResolution?.step === 'after-battle' ? '等待战后选择' : core.battleResolution ? '完成战斗结算' : '结束我的战斗阶段') : '继续';
    const primaryEnabled = Boolean((!isMultiplayer || isConnected!==false) && !interactionBlocked && (!movement.intent || movement.command) && actorId && current && core.phase !== 'complete' && (primary.type==='CONFIRM_ATTACK' ? attackDraft.canConfirm : validate(attackDraft.state, primary).valid));
    const selectingIdentity = !G.sys.tutorial.active && core.phase === 'preparation' && core.round === 1 && Boolean(actor) && !(actorId && (core.phaseCompletedPlayerIds ?? []).includes(actorId));
    const phaseControl = (
<section className="fd-phase-control" aria-label="回合操作" data-tutorial-id="fate-phase">
    {movement.intent && <button type="button" className="fd-movement-cancel" aria-label="取消移动" onClick={movement.cancel}><X size={20}/></button>}
    {deployment.target && <button type="button" className="fd-movement-cancel" aria-label="取消部署" onClick={deployment.cancel}><X size={20}/></button>}
    <div className="fd-phase-copy"><small>{current ? '你的回合' : nameFor(core.currentPlayerId)}</small><b>{primaryLabel}</b></div>
    <button type="button" aria-label={primaryLabel} className="fd-runtime-primary" data-testid="fate-domination-primary-action" disabled={!primaryEnabled} onClick={() => {if(primary.type==='CONFIRM_ATTACK')attackDraft.confirm();else send(primary.type, primary.payload);if(movement.intent)movement.cancel();}}>
     <b>{t(`phases.${core.phase}`)}</b><ArrowRight className="board-shell-fixed-icon" size={18}/>
    </button>
   </section>
    );
    return <UndoProvider value={{ G: G as MatchState<unknown>, dispatch: send, playerID, isGameOver: core.phase === 'complete', isLocalMode: !isMultiplayer }}>
  <div className="fd-runtime-table" data-testid="fate-domination-board" data-played-count={playedCardCount}>
   {selectingIdentity && actor ? <FateIdentitySetup masterId={actor.masterId} servantId={actor.servantId}
    available={(kind,id) => validate(attackDraft.state,kind==='master'?{type:'SELECT_MASTER',playerId:actor.id,payload:{masterId:id}}:{type:'SELECT_SERVANT',playerId:actor.id,payload:{servantId:id}}).valid}
    onSelect={(kind,id) => send(kind==='master'?'SELECT_MASTER':'SELECT_SERVANT',kind==='master'?{masterId:id}:{servantId:id})}
    onInspect={(asset,name) => inspect(asset,name,true,'detail')} onConfirm={()=>send('ADVANCE_PHASE',{})} confirmEnabled={primaryEnabled}/>
    : <>
   <FateMapSurface core={core} viewerId={actorId} locale={i18n.language} legalLocations={targets} movablePlayerId={!interactionBlocked && movement.normalAvailable ? actorId : null} moving={Boolean(movement.intent && !interactionBlocked)} movementOrigin={!interactionBlocked && movement.normalAvailable ? actor?.locationId : null} selectedLocation={movement.target ?? deployment.target} selectedDeploymentSlot={deployment.slot} onPawn={() => {if(interactionBlocked)return;setInspection(null); if(movement.intent)movement.cancel();else movement.begin({kind:'normal'});}} onInspect={(asset,name) => inspect(asset,name,true,'map')} onLocation={(id,slot) => { if(interactionBlocked)return; if(movement.intent) movement.select(id); else deployment.select(id,slot); }}/>
   <header className="fd-runtime-top"><div><small>FATE / DOMINATION</small><h1>命运支配</h1></div><div className="fd-runtime-round">第 {core.round} 回合 <span>{t(`phases.${core.phase}`)}</span></div></header>
   <FatePlayerRail core={core} viewerId={actorId} selectedId={selectedSeat} nameFor={nameFor} onSelect={setSelectedSeat} onDetail={id => { setInspection(null); setDetail(id); setSelectedSeat(id); }} onInspect={(asset,name) => inspect(asset,name,true,'opponent')}/>
   {actor && actorId && <FateSelfDock core={core} playerId={actorId} name={nameFor(actorId)} pileInfo={pile && (pile === 'deck' || !actor.discard.length) ? `${pile === 'deck' ? '抽牌堆' : '弃牌堆'}剩余 ${actor[pile].length} 张` : undefined} sealEnabled={!interactionBlocked && current && core.phase === 'action' && actor.commandSpells > 0} onDetail={() => {setInspection(null);setDetail(actorId);}} onSeal={() => {if(interactionBlocked)return;setInspection(null);setUsingSeal(true);}} onPile={value => {setInspection(null);setPile(previous => previous === value ? null : value);}}/>}
   {pile === 'discard' && actor && actor.discard.length > 0 && <FateDiscardInspection cards={actor.discard} onClose={()=>setPile(null)} onInspect={(asset,name) => inspect(asset,name,true,'discard')}/>}
   {actor && <FateHandSurface phaseControl={phaseControl} rollbackRevision={G.sys.undo.rollbackRevision} player={actor} power={visibleFatePower(core, actor.id, actorId, [...new Set([...actor.activeAttackIds, ...actor.selectedAttackIds])])} skills={skillCards(actorId!)} canSelect={attackDraft.eligible} canSelectCard={attackDraft.canSelect} onSelect={(cardId,faceDown) => {movement.cancel();attackDraft.toggle(cardId,faceDown);}} canPlayAbility={sourceId=>abilityAvailable(actor.id,sourceId)} onPlaySkill={activateAbility} onInspect={(asset, name, pinned = false) => inspect(asset, name, pinned)} onDismissHoverInspection={dismissHoverInspection} shouldSuppressFocusPreview={() => suppressRestoredFocusPreview.current} ridingChoice={ridingChoice ? {
       interactionId: ridingChoice.id,
       round: core.round,
       candidateIds: ridingChoice.data.options.map(option => option.id),
       onConfirm: optionIds => send('SYS_INTERACTION_RESPOND', { interactionId: ridingChoice.id, optionIds }),
       onCancel: () => send('SYS_INTERACTION_CANCEL', { interactionId: ridingChoice.id }),
       onSelectionCountChange:setRidingSelectionCount,
   } : undefined}/>}
   {G.sys.tutorial.active && <FateTutorialUiBridge detail={detail} viewerId={actorId} inspection={Boolean(inspection?.pinned)} inspectionSource={inspection?.source ?? null} publicCards={publicCardsOpen} pile={pile} discardCount={actor?.discard.length ?? 0} seal={usingSeal} movement={Boolean(movement.intent)} movementTarget={Boolean(movement.target)} rollbackRevision={G.sys.undo.rollbackRevision ?? 0}/>}
   {!actor && phaseControl}
   {postBattleChoice && <FatePostBattleChoice rollbackRevision={G.sys.undo.rollbackRevision} interaction={postBattleChoice} viewerId={actorId} onConfirm={(interactionId,optionId)=>send('SYS_INTERACTION_RESPOND',{interactionId,optionId})}/>}
   {detail && <FatePlayerDetail core={core} playerId={detail} viewerId={actorId} servantBack="fate-domination/backs/servant" skillBack="fate-domination/backs/skill" onPlayer={setDetail} onClose={() => { setDetail(null); setInspection(null); }} onInspect={(asset,name) => inspect(asset,name,true,'detail')} canActivateAbility={id => abilityAvailable(detail,id)} onActivateAbility={activateAbility}/>}
   {usingSeal && actorId && <FateCommandSpellChoice core={core} playerId={actorId}
    isLegal={payload => !interactionBlocked && validate(attackDraft.state, {type: 'USE_COMMAND_SPELL', playerId: actorId, payload}).valid}
    onChooseMove={() => {if(interactionBlocked)return;setUsingSeal(false);movement.begin({kind:'seal'});}} onClose={() => setUsingSeal(false)} onConfirm={payload => {if(interactionBlocked)return;send('USE_COMMAND_SPELL',payload);setUsingSeal(false);}}/>}
   </>}
   {inspection && typeof document !== 'undefined' && createPortal(<div style={{zIndex:UI_Z_INDEX.modalContent}} className={inspection.pinned ? 'fd-inspection-backdrop' : 'fd-inspection-hover'} data-opponent-open={Boolean(selectedSeat && selectedSeat !== actorId)} role={inspection.pinned ? 'dialog' : undefined} aria-modal={inspection.pinned ? true : undefined} aria-label={inspection.pinned ? `${inspection.name}卡牌检视` : undefined} onPointerDown={event => {inspectionBackdropPress.current=event.target===event.currentTarget;}} onClick={event => {
    // 长按原牌打开后，浏览器可能把抬手的兼容 click 发给新遮罩；只有起于遮罩的手势才关闭。
    const startedOnBackdrop=inspectionBackdropPress.current;inspectionBackdropPress.current=false;
    if(startedOnBackdrop && event.target===event.currentTarget)dismissInspection();
   }} onKeyDown={event => {if(event.key==='Tab' && inspection.pinned){event.preventDefault();inspectionCloseButton.current?.focus();}}}>
    <div data-tutorial-id="fate-inspection" style={inspection.pinned ? undefined : inspectionPosition} className={`fd-runtime-inspection${inspection.pinned ? ' is-pinned' : ''}`} data-testid="fate-runtime-inspection" onClick={() => {if(!inspection.pinned)dismissInspection();}}>
     <div className="fd-inspection-card-face" data-testid="fate-inspection-card-face"><CardPreview previewRef={fateCardPreview(inspection.asset)} title={inspection.name} style={{width: '100%'}}/></div>
     {inspection.pinned && <button ref={inspectionCloseButton} type="button" className="fd-inspection-close" data-testid="fate-inspection-close" aria-label={`关闭${inspection.name}大图`} onClick={event => {event.stopPropagation();dismissInspection();}}><X className="board-shell-fixed-icon" size={20}/></button>}
    </div>
   </div>, document.body)}
   <FateEndgame {...endgameProps} nameFor={nameFor}/>
  </div>
 </UndoProvider>;
};
export default FateDominationBoard;
