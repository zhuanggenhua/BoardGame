import {CardPreview} from '../../../components/common/media/CardPreview';
import {fateCardPreview} from '../data/cardArtwork';
import './identityArtwork';
import {useLayoutEffect, useRef, useState, type CSSProperties} from 'react';
import {motion} from 'framer-motion';
import {OptimizedImage} from '../../../components/common/media/OptimizedImage';
import {FATE_ATTACK_BY_ID} from '../data';
import type {CardInstance, PlayerState, SkillDefinition} from '../domain/types';
import {projectFateHand} from '../domain/handView';
import './hand-surface.css';
import {useTouchLongPress} from '../../../hooks/ui/useTouchLongPress';
import {useTranslation} from 'react-i18next';

export type FateSkillCardView = {
    skill: SkillDefinition;
    assetPath: string;
    available: boolean;
    abilityAvailable?: boolean;
};

interface Props {
    player: PlayerState;
    power: number;
    skills: readonly FateSkillCardView[];
    canSelect: boolean;
    rollbackRevision?: number;
    requestedCardId?: string;
    canSelectCard?: (id: string, faceDown?: boolean) => boolean;
    onSelect: (id: string, faceDown?: boolean) => void;
    onPlaySkill: (id: string) => void;
    canPlayAbility?: (id: string) => boolean;
    onInspect: (assetPath: string, name: string, pinned?: boolean) => void;
    onDismissHoverInspection?: () => void;
    shouldSuppressFocusPreview?: () => boolean;
    ridingChoice?: {
        interactionId: string;
        round: number;
        candidateIds: readonly string[];
        onConfirm: (cardIds: string[]) => void;
        onCancel: () => void;
        onSelectionCountChange?: (count: number) => void;
    };
}

/** The attack and skill hands stay separate; played cards remain direct card objects. */
export function FateHandSurface({player, power, skills, canSelect, canSelectCard, onSelect, onPlaySkill, canPlayAbility, onInspect, onDismissHoverInspection, shouldSuppressFocusPreview, ridingChoice, requestedCardId, rollbackRevision = 0}: Props) {
    const { t } = useTranslation('game-fate-domination');
    const interactionScope = JSON.stringify([player.id, canSelect, ridingChoice?.interactionId ?? null, ridingChoice?.round ?? null, rollbackRevision]);
    const [faceDownState, setFaceDownState] = useState<{scope: string; value: boolean}>({scope: '', value: false});
    const [ridingSelectionState, setRidingSelectionState] = useState<{scope: string; ids: string[]}>({scope: '', ids: []});
    const surface = useRef<HTMLDivElement>(null);
    useLayoutEffect(()=>{
        if(!requestedCardId)return;
        const cards=surface.current?.querySelectorAll<HTMLElement>('[data-focus-card]');
        const card=Array.from(cards??[]).find(element=>element.dataset.cardId===requestedCardId||element.dataset.focusCard===`skill-${player.id}-${requestedCardId}`);
        const row=card?.closest<HTMLElement>('.fd-runtime-card-row');
        if(card&&row)row.scrollLeft=card.offsetLeft-row.offsetLeft-(row.clientWidth-card.offsetWidth)/2;
    },[requestedCardId,player.id,rollbackRevision]);
    const focusedCard = useRef<{key: string; element: HTMLElement} | null>(null);
    const touchInspection = useTouchLongPress<string,{assetPath:string;name:string}>({
        enabled:true,durationMs:500,moveCancelPx:10,clickBlockMs:500,
        onLongPress:(_key,card)=>onInspect(card.assetPath,card.name,true),
    });
    const clearTouchInspection=touchInspection.clearLongPressState;
    useLayoutEffect(()=>clearTouchInspection(),[interactionScope,clearTouchInspection]);

    useLayoutEffect(() => {
        if (!ridingChoice) setRidingSelectionState({scope: interactionScope, ids: []});
    }, [interactionScope, ridingChoice]);

    // React remounts a card as it moves between hand and play areas. Keep keyboard
    // focus on that same live card when its owning state changes.
    useLayoutEffect(() => {
        // 只恢复换区后真正卸载的实例。检视重渲染恰逢 Tab 的 blur/focus 之间时，
        // 原按钮仍在 DOM，不能把焦点重新拉回刚离开的卡牌。
        if (!focusedCard.current || focusedCard.current.element.isConnected || document.activeElement !== document.body) return;
        const cards = surface.current?.querySelectorAll<HTMLButtonElement>('[data-focus-card]');
        Array.from(cards ?? []).find(card => card.dataset.focusCard === focusedCard.current?.key)?.focus({preventScroll: true});
    }, [player.hand, player.selectedAttackIds, player.activeAttackIds, player.activeSkills]);

    const faceDownMode = faceDownState.scope === interactionScope && faceDownState.value;
    const ridingSelection = ridingSelectionState.scope === interactionScope ? ridingSelectionState.ids : [];
    const onRidingSelectionCountChange=ridingChoice?.onSelectionCountChange;
    useLayoutEffect(()=>onRidingSelectionCountChange?.(ridingSelection.length),[onRidingSelectionCountChange,ridingSelection.length]);
    const toggleRidingSelection = (id: string) => setRidingSelectionState(previous => {
        const ids = previous.scope === interactionScope ? previous.ids : [];
        return {scope: interactionScope, ids: ids.includes(id) ? ids.filter(candidate => candidate !== id) : [...ids, id]};
    });
    const zones = projectFateHand(player);
    const ridingCandidateIds = new Set(ridingChoice?.candidateIds ?? []);
    const ridingCost = ridingSelection.reduce((sum, id) => sum + (FATE_ATTACK_BY_ID[player.hand.find(card => card.id === id)?.definitionId ?? '']?.manaCost ?? Infinity), 0);
    const canConfirmRiding = Boolean(ridingChoice && ridingSelection.length <= 3
        && ridingSelection.every(id => ridingCandidateIds.has(id)) && ridingCost <= player.mana);
    const playedIds = [...new Set([...player.activeAttackIds, ...player.activeSkills, ...player.selectedAttackIds])];
    const staged = player.selectedAttackIds.length > 0;
    const readySkills = skills.filter(item => !player.activeSkills.includes(item.skill.id) && !player.selectedAttackIds.includes(item.skill.id));
    const canUseHoverPreview = () => typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const renderSkill = ({skill, assetPath, available, abilityAvailable}: FateSkillCardView, active = false, stagedSkill = false) => (
        <motion.button
            layout
            layoutId={`fate-skill-${player.id}-${skill.id}`}
            key={skill.id}
            type="button"
            className={`fd-runtime-card${stagedSkill ? ' is-staged' : !ridingChoice && (active ? abilityAvailable : available) ? ' is-available' : ''}`}
            aria-label={t('ui.hand.skillAction', { action: stagedSkill ? t('ui.hand.actions.retract') : active ? t('ui.hand.actions.activate') : t('ui.hand.actions.select'), name: skill.name })}
            aria-disabled={Boolean(ridingChoice) || (active ? !abilityAvailable : !available)}
            data-focus-card={`skill-${player.id}-${skill.id}`}
            data-card-zone={stagedSkill ? 'staged-skill' : active ? 'active-skill' : 'skill'}
            onPointerDown={event=>touchInspection.handlePointerDown(event,`skill-${skill.id}`,{assetPath,name:skill.name})}
            onPointerMove={event=>touchInspection.handlePointerMove(event,`skill-${skill.id}`)}
            onPointerUp={()=>touchInspection.handlePointerUp(`skill-${skill.id}`)}
            onPointerCancel={()=>touchInspection.handlePointerUp(`skill-${skill.id}`)}
            onMouseEnter={() => {if ((active || stagedSkill) && canUseHoverPreview()) onInspect(assetPath, skill.name);}}
            onMouseLeave={() => {if (active || stagedSkill) onDismissHoverInspection?.();}}
            onFocus={event => {if ((active || stagedSkill) && canUseHoverPreview() && !shouldSuppressFocusPreview?.() && event.currentTarget.matches(':focus-visible')) onInspect(assetPath, skill.name);}}
            onBlur={() => {if (active || stagedSkill) onDismissHoverInspection?.();}}
            onContextMenu={event => {event.preventDefault(); onInspect(assetPath, skill.name, true);}}
            onClick={() => {
                if(touchInspection.shouldBlockClick(`skill-${skill.id}`))return;
                if (ridingChoice) return;
                if (active) {
                    if (abilityAvailable) onPlaySkill(skill.id);
                } else if (stagedSkill || available) {
                    onSelect(skill.id);
                }
            }}
        >
            <OptimizedImage src={assetPath} alt={skill.name}/>
        </motion.button>
    );

    const renderAttack = (card: CardInstance, isStaged = false, committed = false) => {
        const definition = FATE_ATTACK_BY_ID[card.definitionId];
        if (!definition) return null;
        const abilityAvailable = committed && Boolean(canPlayAbility?.(card.id));
        const ridingSelected = Boolean(ridingChoice && ridingSelection.includes(card.id));
        const action = ridingChoice
            ? ridingSelected ? t('ui.hand.actions.cancelRideSelection') : t('ui.hand.actions.selectRide')
            : isStaged ? t('ui.hand.actions.retract')
                : committed ? abilityAvailable ? t('ui.hand.actions.activate') : t('ui.hand.actions.inspect')
                    : t('ui.hand.actions.select');
        const ridingCardCost = definition.manaCost;
        const canToggleRiding = Boolean(ridingChoice && ridingCandidateIds.has(card.id) && (ridingSelected
            || (ridingSelection.length < 3 && ridingCost + ridingCardCost <= player.mana)));
        const selectable = ridingChoice ? canToggleRiding : canSelect && (canSelectCard?.(card.id, faceDownMode) ?? true);
        return (
            <motion.button
                layout
                layoutId={`fate-card-${card.id}`}
                key={card.id}
                type="button"
                className={`fd-runtime-card${isStaged ? ' is-staged' : ridingSelected ? ' is-riding-selected' : selectable || (!ridingChoice && abilityAvailable) ? ' is-available' : ''}`}
                initial={{opacity: 0, y: 14}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0, y: -28}}
                transition={{duration: .2}}
                data-focus-card={`attack-${player.id}-${card.id}`}
                data-card-id={card.id}
                data-card-zone={isStaged ? 'staged' : committed ? 'active' : 'hand'}
                onPointerDown={event=>touchInspection.handlePointerDown(event,card.id,{assetPath:definition.assetPath,name:definition.name})}
                onPointerMove={event=>touchInspection.handlePointerMove(event,card.id)}
                onPointerUp={()=>touchInspection.handlePointerUp(card.id)}
                onPointerCancel={()=>touchInspection.handlePointerUp(card.id)}
                aria-label={t('ui.hand.attackAction', { action, name: definition.name })}
                aria-pressed={ridingChoice ? ridingSelected : undefined}
                onMouseEnter={() => {if ((isStaged || committed) && canUseHoverPreview()) onInspect(definition.assetPath, definition.name);}}
                onMouseLeave={() => {if (isStaged || committed) onDismissHoverInspection?.();}}
                onFocus={event => {if ((isStaged || committed) && canUseHoverPreview() && !shouldSuppressFocusPreview?.() && event.currentTarget.matches(':focus-visible')) onInspect(definition.assetPath, definition.name);}}
                onBlur={() => {if (isStaged || committed) onDismissHoverInspection?.();}}
                onContextMenu={event => {event.preventDefault(); onInspect(definition.assetPath, definition.name, true);}}
                onClick={() => {
                    if(touchInspection.shouldBlockClick(card.id))return;
                    if (ridingChoice) {
                        if (ridingCandidateIds.has(card.id) && (ridingSelected || canToggleRiding)) toggleRidingSelection(card.id);
                        return;
                    }
                    if (committed) {
                        if (abilityAvailable) onPlaySkill(card.id);
                        else onInspect(definition.assetPath, definition.name, true);
                    } else if (selectable) {
                        onSelect(card.id, faceDownMode || undefined);
                    }
                }}
                aria-disabled={ridingChoice ? !selectable : !isStaged && !committed && !selectable}
            >
                <CardPreview previewRef={fateCardPreview(definition.assetPath)} title={definition.name} style={{width: '100%'}}/>
                {((player.faceDownAttackIds ?? []).includes(card.id) || (player.selectedFaceDownIds ?? []).includes(card.id)) && <span className="fd-face-down-label">{t('ui.hand.faceDown')}</span>}
            </motion.button>
        );
    };

    const renderPlayed = (id: string) => {
        const card = player.hand.find(candidate => candidate.id === id);
        if (card) return renderAttack(card, player.selectedAttackIds.includes(id), player.activeAttackIds.includes(id));
        const skill = skills.find(item => item.skill.id === id);
        return skill ? renderSkill(skill, player.activeSkills.includes(id), player.selectedAttackIds.includes(id)) : null;
    };

    return (
        <div
            ref={surface}
            className="fd-runtime-hand-grid"
            data-tutorial-id="fate-hand" data-testid="fate-hand-zones"
            data-played-count={playedIds.length}
            data-riding-choice={ridingChoice ? 'true' : undefined}
            onFocusCapture={event => {
                const element = (event.target as HTMLElement).closest<HTMLElement>('[data-focus-card]');
                focusedCard.current = element?.dataset.focusCard ? {key: element.dataset.focusCard, element} : null;
                element?.scrollIntoView?.({block: 'nearest', inline: 'nearest'});
            }}
            onBlurCapture={event => {
                if ((!event.relatedTarget && (event.target as HTMLElement).isConnected) || (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node))) focusedCard.current = null;
            }}
        >
            <section className="fd-runtime-hand-zone fd-attack-hand-zone" aria-label={t('ui.hand.attackHand')}>
                {ridingChoice && <div className="fd-riding-controls" data-testid="fate-riding-controls" aria-live="polite">
                    <span className="fd-riding-status" aria-label={t('ui.hand.ridingStatus', { selected: ridingSelection.length, maximum: 3, cost: Number.isFinite(ridingCost) ? ridingCost : '—', mana: player.mana })}>
                        {t('ui.hand.ridingSelectionSummary', { selected: ridingSelection.length, cost: Number.isFinite(ridingCost) ? ridingCost : '—', mana: player.mana })}
                    </span>
                    <button type="button" data-testid="fate-riding-confirm" disabled={!canConfirmRiding} onClick={() => ridingChoice.onConfirm([...ridingSelection])}>{t('ui.hand.confirmRide', { count: ridingSelection.length })}</button>
                    <button type="button" data-testid="fate-riding-cancel" onClick={ridingChoice.onCancel}>{t('ui.hand.cancelRide')}</button>
                </div>}
                <div className="fd-runtime-play-area" data-testid="fate-play-area">
                    <div className="fd-play-summary" data-testid="fate-play-summary">
                        <span>{staged ? t('ui.hand.preparedToPlay') : t('ui.hand.played')} · {staged ? player.selectedAttackIds.length : playedIds.length}</span>
                        <strong className="fd-play-power">{staged ? t('ui.hand.expectedTotalPower') : t('ui.hand.totalPower')} {power}</strong>
                    </div>
                    <div className="fd-runtime-card-row fd-hand-parallel fd-played-cards" data-testid="fate-played-cards" style={{'--card-count': Math.max(1, playedIds.length)} as CSSProperties}>
                        {playedIds.map(renderPlayed)}
                    </div>
                </div>
                {canSelect && !ridingChoice && <button type="button" className="fd-hand-mode" aria-label={t('ui.hand.selectionMode')} aria-pressed={faceDownMode} onClick={() => setFaceDownState(previous => ({scope: interactionScope, value: !(previous.scope === interactionScope && previous.value)}))}>{faceDownMode ? t('ui.hand.faceDownSelection') : t('ui.hand.faceUpSelection')}</button>}
                <div className="fd-runtime-card-row fd-hand-parallel fd-attack-cards" data-testid="fate-domination-hand" style={{'--card-count': Math.max(1, zones.available.length)} as CSSProperties}>
                    {zones.available.map(card => renderAttack(card))}
                    {!zones.available.length && <span className="fd-runtime-empty-hand">{t('ui.hand.noAttackCards')}</span>}
                </div>
            </section>
            <section data-tutorial-id="fate-skills" className="fd-runtime-hand-zone fd-skill-hand-zone" aria-label={t('ui.hand.skillCards')}>
                <div className="fd-runtime-card-row fd-hand-parallel fd-skill-cards" style={{'--card-count': Math.max(1, readySkills.length)} as CSSProperties}>
                    {readySkills.map(item => renderSkill(item))}
                </div>
            </section>
        </div>
    );
}
