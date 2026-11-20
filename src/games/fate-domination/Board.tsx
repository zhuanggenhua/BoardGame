import { useTutorialBridge } from '../../contexts/TutorialContext';
import { FateTutorialUiBridge, type FateInspectionSource } from './ui/FateTutorialUiBridge';
import { fateTutorialAllows, fateTutorialExpected } from './ui/tutorialContract';
import { fateTutorialAbilitySource, presentFateTutorial } from './ui/tutorialPresentation';
import { FateIdentitySetup } from './ui/FateIdentitySetup';
import { FateFgoEffects } from './ui/FateFgoEffects';
import { UI_Z_INDEX } from '../../core/ui/zIndex';
import { useFateDeploymentInteraction } from './ui/useFateDeploymentInteraction';
import {useFateMapDrag} from './ui/useFateMapDrag';
import {useToast} from '../../contexts/ToastContext';
import {fateTokenAsset} from './ui/identityArtwork';
import {OptimizedImage} from '../../components/common/media/OptimizedImage';
import {useFateAttackDraft} from './ui/useFateAttackDraft';
import { FatePostBattleChoice } from './ui/FatePostBattleChoice';
import { FateEndgame } from './ui/FateEndgame';
import { useEndgame } from '../../hooks/game/useEndgame';
import { isFatePostBattleChoice } from './domain/postBattleChoice';
import { isFateRidingChoice } from './domain/ridingChoice';
import { isFateChariotChoice } from './domain/chariotChoice';
import { fateChariotTargets } from './domain/chariotEvents';
import { FateChariotChoice } from './ui/FateChariotChoice';
import { isFateInvestigationChoice } from './domain/investigationChoice';
import { fateBattlefieldSkillIds, isFateFieldAttackChoice } from './domain/battlefieldAttacks';
import { FateInvestigationChoice } from './ui/FateInvestigationChoice';
import { visibleFatePower } from './domain/playerView';
import {CardPreview} from '../../components/common/media/CardPreview';
import {fateCardPreview} from './data/cardArtwork';
import './ui/identityArtwork';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { GameBoardProps } from '../../engine/transport/protocol';
import type { MatchState } from '../../engine/types';
import { UndoProvider } from '../../contexts/UndoContext';
import { FATE_SERVANT_BY_ID } from './data';
import { FATE_BATTLE_LOCATION_ORDER } from './domain';
import type { FateDominationCommandMap, FateDominationCommand, FateDominationCore, LocationId } from './domain';
import { calculateFatePower } from './domain/power';
import { validate } from './domain/commands';
import { fateLateClimax } from './domain/environmentRules';
import {resolveFateAbilityDefinition,resolveFatePlayerAbility} from './domain/abilityRegistry';
import {projectFateSkillCards} from './domain/playerView';
import {fateAttackManaCost, hasLegalFateNormalPlay, selectedFateAttackCost} from './domain/attackSelection';
import {useFateMovementInteraction} from './ui/useFateMovementInteraction';
import { FateMapSurface } from './ui/FateMapSurface';
import { FateHandSurface, type FateSkillCardView } from './ui/FateHandSurface';
import { FatePlayerDetail } from './ui/FatePlayerDetail';
import { FateCommandSpellChoice } from './ui/FateCommandSpellChoice';
import { useFateAbilityFeedback } from './ui/useFateAbilityFeedback';
import { FateSelfDock } from './ui/FateSelfDock';
import {FateDiscardInspection} from './ui/FateDiscardInspection';
import { FatePlayerRail } from './ui/FatePlayerRail';
import { projectFateOpponentCards, servantSkillsFor } from './ui/playerPresentation';
import './ui/runtime-table.css';
import { placeFateInspection } from './ui/inspectionPlacement';
import { fateIdentityTaken } from './domain/setup';
import { playDeniedSound, useGameAudio } from '../../lib/audio/useGameAudio';
import { FATE_DOMINATION_AUDIO_CONFIG } from './audio.config';
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
    useGameAudio({ gameId: 'fate-domination', config: FATE_DOMINATION_AUDIO_CONFIG, G: G.core, ctx: { playerId: actorId }, eventEntries: G.sys.eventStream.entries });
    const expectedTutorialCommand = fateTutorialExpected(G.sys.tutorial);
    const {warning}=useToast();
    const reject=(reason:string)=>{ playDeniedSound(); warning(reason,undefined,{dedupeKey:`fate-input:${reason}`}); };
    const rejectTutorial=()=>reject(expectedTutorialCommand?.type==='DEPLOY_MASTER'?t('feedback.tutorialDeployment',{location:G.core.battlefield[expectedTutorialCommand.payload.locationId as LocationId]?.label}):t('feedback.tutorialTarget'));
    const send = (type: string, payload: unknown) => {
        if (!fateTutorialAllows(G.sys.tutorial,type,payload)){rejectTutorial();return false;}
        if(isMultiplayer&&isConnected===false){reject(t('feedback.offline'));return false;}
        (dispatch as (type: string, payload: unknown) => void)(type, payload);
        return true;
    };
    const attackDraft = useFateAttackDraft(G,actorId,send,!isMultiplayer || isConnected!==false);
    const core = attackDraft.state.core;
    const { overlayProps: endgameProps } = useEndgame({ result: G.sys.gameover, playerID: isMultiplayer ? playerID : null, reset, matchData, isMultiplayer });
    const postBattleChoice = isFatePostBattleChoice(G.sys.interaction.current) ? G.sys.interaction.current : undefined;
    const ridingChoice = isFateRidingChoice(G.sys.interaction.current) ? G.sys.interaction.current : undefined;
    const chariotChoice = isFateChariotChoice(G.sys.interaction.current) ? G.sys.interaction.current : undefined;
    const investigationChoice = isFateInvestigationChoice(G.sys.interaction.current) ? G.sys.interaction.current : undefined;
    const fieldChoice = isFateFieldAttackChoice(G.sys.interaction.current) ? G.sys.interaction.current : undefined;
    const interactionBlocked=Boolean(G.sys.interaction.current || G.sys.interaction.queue.length);
    const actor = actorId ? core.players[actorId] : undefined;
    const current = Boolean(actor && actorId === core.currentPlayerId);
    const playedCardCount = actor ? new Set([...actor.activeAttackIds, ...actor.activeSkills, ...actor.selectedAttackIds]).size : 0;
    useFateAbilityFeedback(core, actorId, G.sys?.eventStream?.entries);
    const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
    const publicCardsOpen = Boolean(selectedSeat && projectFateOpponentCards(core.players[selectedSeat], actorId));
    const [detail, setDetail] = useState<string | null>(null);
    const [masterAbilityTip,setMasterAbilityTip]=useState(false);
    const [inspection, setInspection] = useState<Inspection | null>(null);
    const [fgoBattleAnchors, setFgoBattleAnchors] = useState<Partial<Record<LocationId, HTMLDivElement>>>({});
    const registerFgoBattleAnchor = React.useCallback((locationId: LocationId, element: HTMLDivElement | null) => {
        setFgoBattleAnchors(current => current[locationId] === element ? current : { ...current, [locationId]: element ?? undefined });
    }, []);
    const [inspectionPosition, setInspectionPosition] = useState<React.CSSProperties>({left:16,top:90});
    const movement = useFateMovementInteraction(attackDraft.state, actorId);
    const deployment = useFateDeploymentInteraction(attackDraft.state, actorId);
    const [usingSeal, setUsingSeal] = useState(false);
    const [pile, setPile] = useState<'deck' | 'discard' | null>(null);
    const [ridingSelectionCount,setRidingSelectionCount]=useState(0);
    const [chariotIntent,setChariotIntent]=useState<string|null>(null);
    const [investigationIntent,setInvestigationIntent]=useState<string|null>(null);
    const allowHoverInspection = !movement.intent && !chariotIntent && !investigationIntent && !usingSeal && !interactionBlocked;
    const [ridingDraft,setRidingDraft]=useState<{scope:string; ids:string[]}>({scope:'',ids:[]});
    const ridingScope = `${ridingChoice?.id ?? ''}:${G.sys.undo.rollbackRevision ?? 0}`;
    const onRidingSelectionChange=React.useCallback((ids:string[])=>setRidingDraft({scope:ridingScope,ids}),[ridingScope]);
    const ridingIds = ridingDraft.scope === ridingScope ? ridingDraft.ids : [];
    const ridingCost = actor ? ridingIds.reduce((sum,id)=>sum+(fateAttackManaCost(actor,id) ?? Infinity),0) : Infinity;
    const ownRidingChoice = Boolean(ridingChoice && ridingChoice.playerId === actorId);
    React.useEffect(() => {
        if (!allowHoverInspection) setInspection(current => current && !current.pinned ? null : current);
    }, [allowHoverInspection]);
    const tutorialDisplay = React.useMemo(() => presentFateTutorial(G.sys.tutorial, {
        inspection: inspection?.pinned ? inspection : null, detail, masterAbilityTip, viewerId:actorId, detailEliminated: Boolean(detail && core.players[detail]?.eliminated), seal: usingSeal, discard: pile === 'discard' && Boolean(actor?.discard.length), deck: pile === 'deck',
        movement: Boolean(movement.intent), postBattle:Boolean(postBattleChoice), chariotChoice: Boolean(chariotChoice && chariotChoice.playerId === actorId), attackStaged:Boolean(actor?.selectedAttackIds.length), ridingSelectionCount, publicCards:publicCardsOpen,
        identity: core.phase === 'preparation' && core.round === 1 && Boolean(actorId && !(core.phaseCompletedPlayerIds ?? []).includes(actorId)),
    }), [G.sys.tutorial, inspection, detail, masterAbilityTip, core.players, usingSeal, pile, actor?.discard.length, actor?.selectedAttackIds.length, movement.intent, postBattleChoice, chariotChoice?.playerId, ridingSelectionCount, publicCardsOpen, core.phase, core.round, actorId, core.phaseCompletedPlayerIds]);
    useTutorialBridge(tutorialDisplay, dispatch as (type: string, payload?: unknown) => void, `${G.sys.eventStream.nextId}:${G.sys.undo.rollbackRevision ?? 0}:${tutorialDisplay.step?.highlightTarget}:${tutorialDisplay.step?.content}`, undefined, G);
    React.useEffect(() => { setUsingSeal(false); setInspection(null); setDetail(null); setPile(null); if (G.sys.tutorial.active) setSelectedSeat(null); }, [actorId, core.currentPlayerId, core.phase, G.sys.interaction.current?.id, G.sys.tutorial.active ? `${G.sys.tutorial.step?.id}:${G.sys.undo.rollbackRevision}` : undefined]);
    React.useEffect(()=>setChariotIntent(null),[actorId,core.currentPlayerId,core.phase,G.sys.interaction.current?.id,G.sys.undo.rollbackRevision]);
    React.useEffect(()=>setInvestigationIntent(null),[actorId,core.currentPlayerId,core.phase,G.sys.interaction.current?.id,G.sys.undo.rollbackRevision]);
    const inspectionSource = React.useRef<HTMLElement | null>(null);
    const inspectionBackdropPress = React.useRef(false);
    const inspectionCloseButton = React.useRef<HTMLButtonElement>(null);
    const restoreInspectionFocus = React.useRef(false);
    const suppressRestoredFocusPreview = React.useRef(false);
    const inspect = (asset: string, name: string, pinned = true, source: FateInspectionSource = 'hand') => {
        if (!pinned && !allowHoverInspection) return;
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
    const chariotTargets=(id:string,sourceId:string)=>fateChariotTargets(core,id).filter(targetCardId=>validate(attackDraft.state,{type:'PLAY_SKILL',playerId:id,payload:{skillId:sourceId,targetCardId}}).valid);
    const investigationTargets=(id:string,sourceId:string)=>core.playerIds.filter(targetPlayerId=>validate(attackDraft.state,{type:'PLAY_SKILL',playerId:id,payload:{skillId:sourceId,targetPlayerId}}).valid);
    const abilityAvailable = (id: string, sourceId: string) => {
        if (interactionBlocked || id !== actorId) return false;
        const effects = resolveFatePlayerAbility(core, id, sourceId)?.effects;
        if (effects?.some(effect => effect.type === 'replace-event')) return chariotTargets(id, sourceId).length > 0;
        if (effects?.some(effect => effect.type === 'investigate-hand')) return investigationTargets(id, sourceId).length > 0;
        if (effects?.some(effect => effect.type === 'movement')) return movement.legalTargets({ kind: 'skill', skillId: sourceId }).length > 0;
        return validate(attackDraft.state, { type: 'PLAY_SKILL', playerId: id, payload: { skillId: sourceId } }).valid;
    };
    const activateAbility = (skillId: string) => {
        if (!actorId) return;
        if(!abilityAvailable(actorId,skillId)){rejectCard(skillId,false,true);return;}
        if(G.sys.tutorial.active&&(expectedTutorialCommand?.type!=='PLAY_SKILL'||expectedTutorialCommand.payload.skillId!==skillId)){rejectTutorial();return;}
        setInspection(null);
        setDetail(null);
        const ability = resolveFatePlayerAbility(core, actorId, skillId);
        if (ability?.effects.some(effect => effect.type === 'investigate-hand')) {
            movement.cancel();setChariotIntent(null);setSelectedSeat(null);setInvestigationIntent(previous=>previous===skillId?null:skillId);
        } else if (ability?.effects.some(effect => effect.type === 'replace-event')) {
            setInvestigationIntent(null);
            movement.cancel();setChariotIntent(previous=>previous===skillId?null:skillId);
        } else if (ability?.effects.some(effect => effect.type === 'riding')) {
            setInvestigationIntent(null);
            setChariotIntent(null);
            movement.cancel();
            send('PLAY_SKILL', {skillId});
        } else if (ability?.effects.some(effect => effect.type === 'movement')) {
            setInvestigationIntent(null);
            setChariotIntent(null);
            movement.begin({kind:'skill',skillId});
        } else {
            setInvestigationIntent(null);
            setChariotIntent(null);
            movement.cancel();
            send('PLAY_SKILL', {skillId});
        }
    };
    const skillCards = (id: string): FateSkillCardView[] => {
        const player = core.players[id];
        const servant = FATE_SERVANT_BY_ID[player.servantId];
        if (id !== actorId) return projectFateSkillCards(player, actorId).map((card,index)=>({
            skill:{id:card?.id??`hidden-${index}`,name:card?.name??'暗置技能'},
            assetPath:card?.assetPath??'fate-domination/backs/skill',available:false,abilityAvailable:false,
        }));
        const placed = fateBattlefieldSkillIds(core, id);
        return servantSkillsFor(player).filter(({ skill }) => !placed.includes(skill.id)).map(({ skill, index }) => ({ skill, assetPath: servant.skillAssetPaths[index],
            available: id===actorId && attackDraft.canSelect(skill.id),
            abilityAvailable: abilityAvailable(id,skill.id) }));
    };
    const targets = interactionBlocked ? [] : movement.intent ? movement.targets : deployment.targets;
    const executeLocation=(id:LocationId,slot?:number|null)=>{
        if(interactionBlocked){reject(t('feedback.resolveChoice'));return;}
        const command=movement.intent?movement.commandFor(id):deployment.commandFor(id,slot);
        if(!command)return;
        const result=validate(attackDraft.state,command);
        if(!result.valid){reject(t(`error.${result.error}`,{defaultValue:t('feedback.unavailable')}));return;}
        if(send(command.type,command.payload))movement.cancel();
    };
    const beginNormalMovement=()=>{
        if(G.sys.tutorial.active&&expectedTutorialCommand?.type!=='MOVE_PLAYER'){rejectTutorial();return;}
        setChariotIntent(null);
        setInvestigationIntent(null);
        movement.begin({kind:'normal'});
    };
    const mapDrag=useFateMapDrag({playerId:actorId,enabled:current&&!interactionBlocked&&Boolean(deployment.targets.length||movement.normalAvailable||movement.intent)&&(!G.sys.tutorial.active||Boolean(movement.intent)||['MOVE_PLAYER','DEPLOY_MASTER'].includes(expectedTutorialCommand?.type??'')),onBegin:()=>{if(actor?.locationId&&!movement.intent)beginNormalMovement();},onDrop:executeLocation,onCancel:movement.cancel});
    const rejectCard=(cardId:string,faceDown=false,ability=false)=>{
        if(G.sys.tutorial.active&&!expectedTutorialCommand){rejectTutorial();return;}
        if(interactionBlocked){reject(t('feedback.resolveChoice'));return;}
        if(!actorId)return;
        const command:FateDominationCommand=ability?{type:'PLAY_SKILL',playerId:actorId,payload:{skillId:cardId}}:{type:'SELECT_ATTACK_CARD',playerId:actorId,payload:{cardId,faceDown}};
        const result=validate(attackDraft.state,command);
        if(!ability && !result.valid && result.error==='wrongPhase'){reject(t('feedback.attackWrongPhase'));return;}
        if(ability && !result.valid && result.error==='movementTargetRequired'){
            reject(t(fateLateClimax(core.situation) ? 'feedback.noMoveDestinationClimax' : 'feedback.noMoveDestination'));
            return;
        }
        reject(result.valid?t('feedback.unavailable'):t(`error.${result.error}`,{defaultValue:t('feedback.unavailable')}));
    };
    const selectCard=(cardId:string,faceDown?:boolean)=>{
        if(!actor?.selectedAttackIds.includes(cardId)&&G.sys.tutorial.active&&(expectedTutorialCommand?.type!=='CONFIRM_ATTACK'||(!(expectedTutorialCommand.payload.cardIds as string[]).includes(cardId)||(expectedTutorialCommand.payload.faceDownIds as string[]).includes(cardId)!==Boolean(faceDown)))){rejectTutorial();return;}
        setChariotIntent(null);setInvestigationIntent(null);movement.cancel();attackDraft.toggle(cardId,faceDown);
    };
    const nextLocation = FATE_BATTLE_LOCATION_ORDER.find(id => !core.resolvedLocations.includes(id));
    const phasePrimary: FateDominationCommand = core.phase === 'action'
        ? actor?.selectedAttackIds.length
            ? { type: 'CONFIRM_ATTACK', playerId: actorId ?? '', payload: attackDraft.payload }
            : { type: 'PASS_ACTION', playerId: actorId ?? '', payload: {} }
        : core.phase === 'battle' && core.battleResolution?.step === 'locations' && nextLocation
            ? { type: 'RESOLVE_LOCATION', playerId: actorId ?? '', payload: { locationId: nextLocation } }
            : { type: 'ADVANCE_PHASE', playerId: actorId ?? '', payload: {} };
    const primary = phasePrimary;
    const chariotTargetIds = chariotIntent && actorId
        ? chariotTargets(actorId, chariotIntent).filter(targetCardId => fateTutorialAllows(G.sys.tutorial, 'PLAY_SKILL', { skillId: chariotIntent, targetCardId }))
        : [];
    const investigationTargetIds = investigationIntent && actorId
        ? investigationTargets(actorId, investigationIntent).filter(targetPlayerId => fateTutorialAllows(G.sys.tutorial, 'PLAY_SKILL', { skillId: investigationIntent, targetPlayerId }))
        : investigationChoice ? [] : undefined;
    const selectInvestigationTarget=(targetPlayerId:string)=>{
        if (!investigationIntent || !actorId) return;
        const payload = { skillId: investigationIntent, targetPlayerId };
        const result = validate(attackDraft.state, { type: 'PLAY_SKILL', playerId: actorId, payload });
        if (!result.valid) {
            reject(t(`error.${result.error}`, { defaultValue: t('feedback.unavailable') }));
            return;
        }
        if (send('PLAY_SKILL', payload)) setInvestigationIntent(null);
    };
    const primaryLabel = ownRidingChoice ? t('ui.board.confirmRiding') : chariotIntent ? t('ui.board.chooseChariotTarget') : movement.intent
        ? t('ui.board.selectMoveTarget')
        : core.phase === 'action'
            ? actor?.selectedAttackIds.length ? t('ui.board.confirmAttack') : actor && !actor.normalAttackPlayed && hasLegalFateNormalPlay(core, actor.id) ? t('ui.board.selectTwoAttacks') : t('ui.board.endAction')
            : core.phase === 'preparation' ? t('ui.board.finishPreparation')
                : core.phase === 'outpost'
                    ? !actor?.locationId ? t('ui.board.selectDeploymentSpace') : t('ui.board.endOutpost')
                    : primary.type === 'RESOLVE_LOCATION' && nextLocation ? t('ui.board.resolveLocation', { location: core.battlefield[nextLocation].label })
                        : core.phase === 'battle'
                            ? core.battleResolution?.step === 'after-battle' ? t('ui.board.waitPostBattleChoice') : core.battleResolution ? t('ui.board.finishBattleResolution') : t('ui.board.endBattle')
                            : t('ui.board.continue');
    const primaryEnabled = Boolean((!isMultiplayer || isConnected!==false) && actorId && current && core.phase !== 'complete' && (ownRidingChoice ? ridingIds.length <= 3 && ridingIds.every(id=>ridingChoice!.data.options.some(option=>option.id===id)) && ridingCost <= (actor?.mana ?? -1) : !interactionBlocked && !movement.intent && !chariotIntent && !investigationIntent && (primary.type==='CONFIRM_ATTACK' ? attackDraft.canConfirm : validate(attackDraft.state, primary).valid)));
    const selectingIdentity = !G.sys.tutorial.active && core.phase === 'preparation' && core.round === 1 && Boolean(actor) && !(actorId && (core.phaseCompletedPlayerIds ?? []).includes(actorId));
    const phaseControl = (
<section className="fd-phase-control" aria-label={t('ui.board.turnActions')} data-tutorial-id="fate-phase">
    {!current && <div className="fd-phase-copy"><small>{nameFor(core.currentPlayerId)}</small></div>}
    {investigationIntent ? <span role="status" className="fd-phase-target-hint">{t('ui.investigationChoice.chooseTarget')}</span> : <button type="button" aria-label={primaryLabel} className="fd-runtime-primary" data-testid="fate-domination-primary-action" disabled={!primaryEnabled} onClick={() => {if(ownRidingChoice && ridingChoice)send('SYS_INTERACTION_RESPOND',{interactionId:ridingChoice.id,optionIds:ridingIds});else if(primary.type==='CONFIRM_ATTACK')attackDraft.confirm();else send(primary.type, primary.payload);if(movement.intent)movement.cancel();}}>
     {primaryLabel}
    </button>}
   </section>
    );
    return <UndoProvider value={{ G: G as MatchState<unknown>, dispatch: send, playerID, isGameOver: core.phase === 'complete', isLocalMode: !isMultiplayer }}>
  <div className="fd-runtime-table" data-testid="fate-domination-board" data-played-count={playedCardCount} data-dragging-pawn={mapDrag.point?'true':undefined} onPointerDownCapture={mapDrag.onPointerDownCapture} onClickCapture={mapDrag.onClickCapture}>
   <FateFgoEffects state={G} viewerId={actorId} battleAnchors={fgoBattleAnchors}/>
   {selectingIdentity && actor ? <FateIdentitySetup key={actor.id} masterId={actor.masterId} servantId={actor.servantId}
    available={(kind,id) => kind === 'master'
      ? !fateIdentityTaken(core,actor.id,'masterId',id) && validate(attackDraft.state,{type:'SELECT_MASTER',playerId:actor.id,payload:{masterId:id}}).valid
      : validate(attackDraft.state,{type:'SELECT_SERVANT',playerId:actor.id,payload:{servantId:id}}).valid}
    onInspect={(asset,name) => inspect(asset,name,true,'detail')} onConfirm={identities=>send('ADVANCE_PHASE',{identities})} confirmEnabled={primaryEnabled}/>
    : <>
   <FateMapSurface core={core} viewerId={actorId} locale={i18n.language} legalLocations={targets} canUseLocation={(id,slot)=>{const command=movement.intent?movement.commandFor(id):deployment.commandFor(id,slot);return Boolean(command&&fateTutorialAllows(G.sys.tutorial,command.type,command.payload));}} movablePlayerId={!interactionBlocked && (movement.normalAvailable||movement.intent) ? actorId : null} moving={Boolean(movement.intent && !interactionBlocked)} movementOrigin={!interactionBlocked && movement.normalAvailable ? actor?.locationId : null} onPawn={() => {if(interactionBlocked)return;setInspection(null); if(movement.intent)movement.cancel();else beginNormalMovement();}} onInspect={(asset,name) => inspect(asset,name,true,'map')} onLocation={executeLocation} onBattleAnchorChange={registerFgoBattleAnchor} chariotTargetIds={chariotTargetIds} chariotChoiceOpen={Boolean(chariotChoice && chariotChoice.playerId===actorId)} onChariotTarget={targetCardId=>{if(!chariotIntent||!send('PLAY_SKILL',{skillId:chariotIntent,targetCardId}))return false;setChariotIntent(null);return true;}}/>
   {mapDrag.point&&actor&&createPortal(<div className="fd-pawn-drag-ghost" style={{left:mapDrag.point.x,top:mapDrag.point.y}}><OptimizedImage src={fateTokenAsset(actor.masterId)} alt=""/></div>,document.body)}
   <header className="fd-runtime-top"><div><small>{t('brand')}</small><h1>{t('title')}</h1></div><div className="fd-runtime-round">{t('ui.board.roundNumber', { round: core.round })} <span>{t(`phases.${core.phase}`)}</span></div></header>
   <FatePlayerRail core={core} viewerId={actorId} selectedId={selectedSeat} nameFor={nameFor} onSelect={setSelectedSeat} onDetail={id => { setInspection(null); setDetail(id); setSelectedSeat(id); }} onInspect={(asset,name) => inspect(asset,name,true,'opponent')} investigationTargets={investigationTargetIds} onInvestigateTarget={selectInvestigationTarget}/>
   {actor && actorId && <FateSelfDock core={core} playerId={actorId} name={nameFor(actorId)} draftManaCost={ownRidingChoice ? ridingCost : selectedFateAttackCost(actor,core.round)} canActivateAbility={id=>abilityAvailable(actorId,id)} onActivateAbility={activateAbility} onAbilityTipChange={setMasterAbilityTip} pileInfo={pile && (pile === 'deck' || !actor.discard.length) ? `${pile === 'deck' ? '抽牌堆' : '弃牌堆'}剩余 ${pile === 'deck' ? (actor.publicView?.deckCount ?? actor.deck.length) : actor.discard.length} 张` : undefined} sealEnabled={!interactionBlocked && current && core.phase === 'action' && actor.commandSpells > 0} investigationTarget={investigationTargetIds?.includes(actorId)} onDetail={() => {if(investigationIntent){selectInvestigationTarget(actorId);return;}if(investigationChoice)return;setInspection(null);setDetail(actorId);}} onSeal={() => {if(interactionBlocked)return;setInspection(null);setChariotIntent(null);setInvestigationIntent(null);movement.cancel();setUsingSeal(true);}} onPile={value => {setInspection(null);setPile(previous => previous === value ? null : value);}}/>}
   {pile === 'discard' && actor && actor.discard.length > 0 && <FateDiscardInspection cards={actor.discard} onClose={()=>setPile(null)} onInspect={(asset,name) => inspect(asset,name,true,'discard')}/>}
   {actor && <FateHandSurface round={core.round} requestedCardId={fateTutorialAbilitySource(G.sys.tutorial)} rollbackRevision={G.sys.undo.rollbackRevision} player={actor} power={visibleFatePower(core, actor.id, actorId, [...new Set([...actor.activeAttackIds, ...actor.selectedAttackIds])])} skills={skillCards(actorId!)} canSelect={attackDraft.eligible} canSelectCard={attackDraft.canSelect} onSelect={selectCard} onRejectCard={rejectCard} onReject={reject} canPlayAbility={sourceId=>abilityAvailable(actor.id,sourceId)} onPlaySkill={activateAbility} onInspect={(asset, name, pinned = false) => inspect(asset, name, pinned)} onDismissHoverInspection={dismissHoverInspection} shouldSuppressFocusPreview={() => suppressRestoredFocusPreview.current} ridingChoice={ownRidingChoice && ridingChoice ? {
       interactionId: ridingChoice.id,
       round: core.round,
       candidateIds: ridingChoice.data.options.map(option => option.id),
       onConfirm: optionIds => send('SYS_INTERACTION_RESPOND', { interactionId: ridingChoice.id, optionIds }),
       onCancel: () => send('SYS_INTERACTION_CANCEL', { interactionId: ridingChoice.id }),
       onSelectionCountChange:setRidingSelectionCount,
       onSelectionChange:onRidingSelectionChange,
       sourceSkillId:ridingChoice.data.fateContext.skillId,
   } : undefined}/>}
   {chariotChoice && chariotChoice.playerId===actorId && <FateChariotChoice interaction={chariotChoice} canChoose={optionId=>fateTutorialAllows(G.sys.tutorial,'SYS_INTERACTION_RESPOND',{interactionId:chariotChoice.id,optionId})} onChoose={optionId=>send('SYS_INTERACTION_RESPOND',{interactionId:chariotChoice.id,optionId})} onInspect={(asset,name)=>inspect(asset,name,true,'map')}/>}
   {investigationChoice && investigationChoice.playerId===actorId && <FateInvestigationChoice interaction={investigationChoice} targetName={nameFor(investigationChoice.data.fateContext.targetPlayerId)} canChoose={optionId=>fateTutorialAllows(G.sys.tutorial,'SYS_INTERACTION_RESPOND',{interactionId:investigationChoice.id,optionId})} onChoose={optionId=>send('SYS_INTERACTION_RESPOND',{interactionId:investigationChoice.id,optionId})} onInspect={(asset,name)=>inspect(asset,name,true,'opponent')}/>}
   {G.sys.tutorial.active && <FateTutorialUiBridge detail={detail} viewerId={actorId} inspection={Boolean(inspection?.pinned)} inspectionSource={inspection?.source ?? null} publicCards={publicCardsOpen} pile={pile} discardCount={actor?.discard.length ?? 0} seal={usingSeal} movement={Boolean(movement.intent)} movementTarget={false} rollbackRevision={G.sys.undo.rollbackRevision ?? 0}/>}
   {fieldChoice && fieldChoice.playerId === actorId && <section className="fd-phase-control fd-field-attack-choice" aria-label={t('ui.map.fieldAttackChoice')} data-testid="fate-field-attack-choice">
    {fieldChoice.data.options.map(option => <button key={option.id} type="button" className="fd-runtime-primary" disabled={isConnected===false} onClick={() => send('SYS_INTERACTION_RESPOND', { interactionId: fieldChoice.id, optionId: option.id })}>
     {option.id === 'place' ? t('ui.map.placeFieldAttack', { location: core.battlefield[fieldChoice.data.field.locationId].label }) : t('ui.map.closeFieldAttack')}
    </button>)}
   </section>}
   {!selectingIdentity && chariotChoice?.playerId !== actorId && investigationChoice?.playerId !== actorId && fieldChoice?.playerId !== actorId && phaseControl}
   {postBattleChoice && <FatePostBattleChoice rollbackRevision={G.sys.undo.rollbackRevision} interaction={postBattleChoice} viewerId={actorId} onConfirm={(interactionId,optionId)=>send('SYS_INTERACTION_RESPOND',{interactionId,optionId})}/>}
   {detail && <FatePlayerDetail core={core} playerId={detail} viewerId={actorId} servantBack="fate-domination/backs/servant" skillBack="fate-domination/backs/skill" onPlayer={setDetail} onClose={() => { setDetail(null); setInspection(null); }} onInspect={(asset,name) => inspect(asset,name,true,'detail')}/>}
   {usingSeal && actorId && <FateCommandSpellChoice core={core} playerId={actorId}
    isLegal={payload => !interactionBlocked && validate(attackDraft.state, {type: 'USE_COMMAND_SPELL', playerId: actorId, payload}).valid}
    onChooseMove={() => {if(interactionBlocked)return;setUsingSeal(false);movement.begin({kind:'seal'});}} onClose={() => setUsingSeal(false)} onConfirm={payload => {if(interactionBlocked)return;send('USE_COMMAND_SPELL',payload);setUsingSeal(false);}}/>}
   </>}
   {inspection && (inspection.pinned || allowHoverInspection) && typeof document !== 'undefined' && createPortal(<div style={{zIndex:UI_Z_INDEX.modalContent}} className={inspection.pinned ? 'fd-inspection-backdrop' : 'fd-inspection-hover'} data-opponent-open={publicCardsOpen} role={inspection.pinned ? 'dialog' : undefined} aria-modal={inspection.pinned ? true : undefined} aria-label={inspection.pinned ? `${inspection.name}卡牌检视` : undefined} onPointerDown={event => {inspectionBackdropPress.current=event.target===event.currentTarget;}} onClick={event => {
    // 长按原牌打开后，浏览器可能把抬手的兼容 click 发给新遮罩；只有起于遮罩的手势才关闭。
    const startedOnBackdrop=inspectionBackdropPress.current;inspectionBackdropPress.current=false;
    if(startedOnBackdrop && event.target===event.currentTarget)dismissInspection();
   }} onKeyDown={event => {if(event.key==='Tab' && inspection.pinned){event.preventDefault();inspectionCloseButton.current?.focus();}}}>
    <div data-tutorial-id="fate-inspection" style={inspection.pinned ? undefined : inspectionPosition} className={`fd-runtime-inspection${inspection.pinned ? ' is-pinned' : ''}`} data-testid="fate-runtime-inspection" onClick={() => {if(!inspection.pinned)dismissInspection();}}>
     <div className="fd-inspection-card-face" data-testid="fate-inspection-card-face"><CardPreview previewRef={fateCardPreview(inspection.asset)} title={inspection.name} style={{width: '100%'}}/></div>
     {inspection.pinned && <button ref={inspectionCloseButton} type="button" className="fd-inspection-close" data-testid="fate-inspection-close" aria-label={`关闭${inspection.name}大图`} onClick={event => {event.stopPropagation();dismissInspection();}}><X className="board-shell-fixed-icon" size={20}/></button>}
    </div>
   </div>, document.body)}
   <FateEndgame {...endgameProps} nameFor={nameFor} victoryCondition={core.gameResult?.victoryCondition}/>
  </div>
 </UndoProvider>;
};
export default FateDominationBoard;
