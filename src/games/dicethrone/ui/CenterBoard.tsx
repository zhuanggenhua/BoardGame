import React from 'react';
import { createPortal } from 'react-dom';
import './CenterBoard.css';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { UI_Z_INDEX } from '../../../core';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import { CardPreview, getCardPreviewAspectRatio } from '../../../components/common/media/CardPreview';
import { useCoarsePointer } from '../../../hooks/ui/useCoarsePointer';
import { AbilityOverlays } from './AbilityOverlays';
import type { AbilityOverlaysHandle } from './AbilityOverlays';
import { ASSETS } from './assets';
import { getAbilitySlotLayoutForCharacter, getPlayerBoardAspectRatio, getPlayerBoardUiTuning } from './abilitySlotLayout';
import type { AbilityCard } from '../types';
import { hasDiceThroneTipBoard, type HeroState } from '../domain/types';
import { NyraCompanionPanel, type NyraDamageResponse } from './NyraCompanionPanel';
import {
    buildBoardShellInlineUnitValue,
    buildBoardShellScreenPixelValue,
} from '../../../shared/runtimeLayoutUnits';

export interface CenterBoardProps {
    coreAreaHighlighted: boolean;
    isTipOpen: boolean;
    onToggleTip: () => void;
    isLayoutEditing: boolean;
    isSelfView: boolean;
    availableAbilityIds: string[];
    canSelectAbility: boolean;
    canHighlightAbility: boolean;
    onSelectAbility: (abilityId: string) => void;
    onHighlightedAbilityClick?: () => void;
    selectedAbilityId?: string;
    activatingAbilityId?: string;
    abilityLevels?: Record<string, number>;
    characterId?: HeroState['characterId'];
    playerBoardFace?: HeroState['playerBoardFace'];
    locale?: string;
    onMagnifyImage: (image: string) => void;
    onMagnifyCard: (card: AbilityCard) => void;
    abilityOverlaysRef?: React.Ref<AbilityOverlaysHandle>;
    playerTokens?: Record<string, number>;
    nyraPlayer?: HeroState;
    nyraDamageResponse?: NyraDamageResponse;
    preparedSpells?: AbilityCard[];
}

const PreparedSpellsOverlay = ({ preparedSpells, locale, onMagnifyCard, showTouchMagnifyButton }: {
    preparedSpells: AbilityCard[];
    locale?: string;
    onMagnifyCard: (card: AbilityCard) => void;
    showTouchMagnifyButton: boolean;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const preparedScrollRef = React.useRef<HTMLDivElement>(null);
    const zoneRef = React.useRef<HTMLDivElement>(null);
    const [zoneCorner, setZoneCorner] = React.useState<{ left: number; bottom: number }>();
    const [currentIndex, setPreparedIndex] = React.useState(0);
    const [cardsHidden, setCardsHidden] = React.useState(false);
    React.useLayoutEffect(() => {
        const zone = zoneRef.current;
        if (!zone) return;
        let frame = 0;
        const update = () => {
            const rect = zone.getBoundingClientRect();
            const buttonSize = showTouchMagnifyButton ? 44 : 32;
            const visibleHeight = 28;
            const verticalInset = (buttonSize - visibleHeight) / 2;
            let bottom = rect.bottom;
            const resources = [...document.querySelectorAll<HTMLElement>('[data-dicethrone-resource]')]
                .map(element => element.getBoundingClientRect())
                .filter(resource => resource.width > 0 && resource.height > 0
                    && resource.left - 12 < rect.left && resource.right + 12 > rect.left - buttonSize)
                .sort((a, b) => b.top - a.top);
            for (const resource of resources) {
                if (bottom - verticalInset > resource.top - 16 && bottom - verticalInset - visibleHeight < resource.bottom + 16) {
                    // 资源条受击会位移与旋转，给它保留动画空间，避免按钮跟着抖动。
                    const below = resource.bottom + 16 + visibleHeight + verticalInset;
                    bottom = below - verticalInset <= rect.bottom + 64 && below <= window.innerHeight
                        ? below : resource.top - 16 + verticalInset;
                }
            }
            setZoneCorner(previous => previous?.left === rect.left && previous.bottom === bottom
                ? previous : { left: rect.left, bottom });
        };
        const boardGroup = zone.closest('[data-tutorial-id="player-board"]')?.parentElement;
        const followTransition = (event: Event) => {
            if (!(event.target instanceof Node) || !boardGroup?.contains(event.target)) return;
            cancelAnimationFrame(frame);
            const until = performance.now() + 600;
            const tick = () => {
                update();
                if (performance.now() < until) frame = requestAnimationFrame(tick);
            };
            tick();
        };
        const observer = new ResizeObserver(update);
        observer.observe(zone);
        document.querySelectorAll<HTMLElement>('[data-dicethrone-resource]').forEach(resource => observer.observe(resource));
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        document.addEventListener('transitionrun', followTransition, true);
        update();
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
            document.removeEventListener('transitionrun', followTransition, true);
        };
    }, [showTouchMagnifyButton]);
    const slot = getAbilitySlotLayoutForCharacter('doctor_strange').find(item => item.id === 'sky')!;
    const goToSpell = (index: number) => {
        const list = preparedScrollRef.current;
        const first = list?.children[0] as HTMLElement | undefined;
        const target = list?.children[index] as HTMLElement | undefined;
        if (list && first && target) {
            list.scrollTo({ left: target.offsetLeft - first.offsetLeft, behavior: 'auto' });
            setPreparedIndex(index);
        }
    };
        return (
            <div
                ref={zoneRef}
                className="pointer-events-none absolute z-30"
                style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%`, zIndex: UI_Z_INDEX.hud + 1 }}
                data-prepared-spell-zone="public"
                data-player-panel-slot="vishanti-book-prepared-spells"
                onClick={event => event.stopPropagation()}
            >
                {zoneCorner && createPortal(<button
                    type="button"
                    data-testid="dt-prepared-spells-visibility"
                    aria-label={t(cardsHidden ? 'doctorStrange.showPreparedCards' : 'doctorStrange.hidePreparedCards')}
                    title={t(cardsHidden ? 'doctorStrange.showPreparedCards' : 'doctorStrange.hidePreparedCards')}
                    aria-pressed={cardsHidden}
                    onClick={() => setCardsHidden(hidden => !hidden)}
                    className="pointer-events-auto fixed flex items-center justify-end bg-transparent"
                    style={{ left: zoneCorner.left, top: zoneCorner.bottom, transform: 'translate(-100%, -100%)', zIndex: UI_Z_INDEX.hud + 1, width: showTouchMagnifyButton ? 44 : 32, height: showTouchMagnifyButton ? 44 : 32 }}
                >
                    <span className="flex items-center justify-center rounded-l-full border border-r-0 border-amber-300 bg-amber-900 text-amber-50" style={{ width: 30, height: 28 }}>
                        {cardsHidden
                            ? <Eye aria-hidden="true" style={{ width: 18, height: 18 }} />
                            : <EyeOff aria-hidden="true" style={{ width: 18, height: 18 }} />}
                    </span>
                </button>, document.body)}
                <div className="pointer-events-auto absolute inset-0" style={{ display: cardsHidden ? 'none' : undefined }}>
                {preparedSpells.length > 1 && (
                    <span className="pointer-events-none absolute right-0 top-0 z-10 rounded bg-slate-950/90 px-1 font-semibold text-amber-100" style={{ fontSize: buildBoardShellScreenPixelValue(11) }}>
                        {currentIndex + 1}/{preparedSpells.length}
                    </span>
                )}
                {preparedSpells.length > 1 && showTouchMagnifyButton && (
                    <button
                        type="button"
                        aria-label={t('configReview.actions.nextPage')}
                        data-prepared-spell-direction="next"
                        onClick={() => goToSpell((currentIndex + 1) % preparedSpells.length)}
                        className="absolute right-0 top-0 z-20 flex items-end justify-end bg-transparent"
                        style={{ width: buildBoardShellScreenPixelValue(44), height: buildBoardShellScreenPixelValue(44) }}
                    >
                        <span className="flex items-center justify-center rounded-full bg-black/80 font-bold leading-none text-white" style={{ width: buildBoardShellScreenPixelValue(20), height: buildBoardShellScreenPixelValue(20), fontSize: buildBoardShellScreenPixelValue(16) }}>›</span>
                    </button>
                )}
                {preparedSpells.length > 1 && !showTouchMagnifyButton && ([-1, 1] as const).map(direction => (
                    <button
                        key={direction}
                        type="button"
                        aria-label={t(direction < 0 ? 'configReview.actions.previousPage' : 'configReview.actions.nextPage')}
                        disabled={direction < 0 ? currentIndex === 0 : currentIndex === preparedSpells.length - 1}
                        onClick={() => goToSpell(currentIndex + direction)}
                        className="absolute right-0 z-20 flex items-center justify-center rounded-full bg-black/80 font-bold leading-none text-white disabled:opacity-35"
                        style={{ top: direction < 0 ? '35%' : '65%', width: buildBoardShellScreenPixelValue(20), height: buildBoardShellScreenPixelValue(20), fontSize: buildBoardShellScreenPixelValue(16), translate: 'none', transform: 'translateY(-50%)' }}
                        data-prepared-spell-direction={direction < 0 ? 'previous' : 'next'}
                    >
                        {direction < 0 ? '‹' : '›'}
                    </button>
                ))}
                <div
                    ref={preparedScrollRef}
                    className={`flex h-full w-full items-center gap-[3%] overflow-x-auto overflow-y-hidden ${preparedSpells.length === 1 ? 'justify-center' : ''}`}
                    onScroll={event => {
                        const list = event.currentTarget;
                        const first = list.children[0] as HTMLElement | undefined;
                        const second = list.children[1] as HTMLElement | undefined;
                        if (first && second) setPreparedIndex(Math.round(list.scrollLeft / (second.offsetLeft - first.offsetLeft)));
                    }}
                >
                    {preparedSpells.map(card => (
                        <button
                            key={card.id}
                            type="button"
                            className="h-full max-w-full shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                            style={{ aspectRatio: card.previewRef ? getCardPreviewAspectRatio(card.previewRef, locale) : undefined }}
                            aria-label={t(card.name, { defaultValue: card.name })}
                            data-prepared-spell-card={card.id}
                            data-board-magnify-ignore="true"
                            onClick={() => onMagnifyCard(card)}
                        >
                            <CardPreview previewRef={card.previewRef} locale={locale} alt={t(card.name, { defaultValue: card.name })}
                                className="h-full w-full" />
                        </button>
                    ))}
                </div>
                </div>
            </div>
        );
};

export const CenterBoard = ({
    coreAreaHighlighted,
    isTipOpen,
    onToggleTip,
    isLayoutEditing,
    isSelfView,
    availableAbilityIds,
    canSelectAbility,
    canHighlightAbility,
    onSelectAbility,
    onHighlightedAbilityClick,
    selectedAbilityId,
    activatingAbilityId,
    abilityLevels,
    characterId = 'monk',
    playerBoardFace,
    locale,
    onMagnifyImage,
    onMagnifyCard,
    abilityOverlaysRef,
    playerTokens,
    nyraPlayer,
    nyraDamageResponse,
    preparedSpells,
}: CenterBoardProps) => {
    const { t } = useTranslation('game-dicethrone');
    const showTouchMagnifyButton = useCoarsePointer();
    const boardUiTuning = getPlayerBoardUiTuning(characterId);
    const playerBoardAspectRatio = getPlayerBoardAspectRatio(characterId);
    const playerBoardHeightUnits = boardUiTuning.playerBoardBaseHeightUnits;
    const tipBoardHeightUnits = boardUiTuning.tipBoardHeightUnits;
    const hasTipBoard = hasDiceThroneTipBoard(characterId);
    // 女猎手提示卡恢复显示后，组合宽度增加；右移少量以保持妮拉面板不侵入左侧回合栏。
    const shellTranslateX = boardUiTuning.shellTranslateX + (characterId === 'lieren' ? 0.5 : 0);
    const shellTransform = shellTranslateX === 0 ? '' : `translateX(${buildBoardShellInlineUnitValue(shellTranslateX)})`;
    const shellFrameClassName = 'absolute bottom-0 flex items-center justify-center pointer-events-auto';
    const overlayButtonIconClassName = 'dt-board-magnify-icon fill-current';
    const overlayButtonClassName = `absolute flex items-center justify-center p-0 text-white transition-[filter,opacity] duration-300 hover:brightness-125 ${showTouchMagnifyButton ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`;
    const overlayButtonVisualClassName = 'absolute top-0 right-0 flex items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-xl';
    const overlayButtonVisualStyle = {
        width: buildBoardShellInlineUnitValue(2.6),
        height: buildBoardShellInlineUnitValue(2.6),
    } as const;
    const overlayButtonStyle = {
        top: buildBoardShellInlineUnitValue(boardUiTuning.magnifyButtonTop),
        right: buildBoardShellInlineUnitValue(0.9),
        width: buildBoardShellScreenPixelValue(44),
        height: buildBoardShellScreenPixelValue(44),
        minWidth: buildBoardShellScreenPixelValue(44),
        minHeight: buildBoardShellScreenPixelValue(44),
        maxWidth: buildBoardShellScreenPixelValue(44),
        maxHeight: buildBoardShellScreenPixelValue(44),
        appearance: 'none',
        WebkitAppearance: 'none',
        fontSize: '0',
        lineHeight: '0',
    } as const;
    const tipBoardOverlayButtonStyle = {
        ...overlayButtonStyle,
        top: buildBoardShellInlineUnitValue(0.25),
        right: buildBoardShellInlineUnitValue(0.25),
    } as const;
    const tipToggleButtonStyle = {
        [isTipOpen ? 'right' : 'left']: isTipOpen ? buildBoardShellInlineUnitValue(0.8) : buildBoardShellInlineUnitValue(0.1),
        padding: buildBoardShellInlineUnitValue(0.5),
        minWidth: buildBoardShellScreenPixelValue(44),
        minHeight: buildBoardShellScreenPixelValue(44),
    } as const;
    const tipToggleButtonClassName = 'absolute top-[55%] z-50 flex text-[inherit] -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white/50 transition-[background-color,color,border-color] duration-500 border border-white/8 hover:bg-black/50 hover:text-white hover:border-white/16';

    const playerBoardPath = ASSETS.PLAYER_BOARD(characterId, playerBoardFace);
    const tipBoardPath = ASSETS.TIP_BOARD(characterId);
    const shouldAnimateBoardFlip = characterId === 'cursed_pirate';
    const cursedPirateVisibleFace = playerBoardFace === 'normal' ? 'normal' : 'cursed';
    const cursedPirateNormalBoardPath = shouldAnimateBoardFlip
        ? ASSETS.PLAYER_BOARD(characterId, 'normal')
        : playerBoardPath;
    const cursedPirateCursedBoardPath = shouldAnimateBoardFlip
        ? ASSETS.PLAYER_BOARD(characterId, 'cursed')
        : playerBoardPath;
    const true3DBoardFlipMotion = {
        rotateY: cursedPirateVisibleFace === 'normal' ? 0 : 180,
        transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] as const },
    };

    const handleMagnifySurfaceClick = React.useCallback((
        event: React.MouseEvent<HTMLElement>,
        imagePath: string,
    ) => {
        if (isLayoutEditing) {
            return;
        }

        const target = event.target as HTMLElement | null;
        if (target?.closest('[data-ability-slot], [data-board-magnify-ignore="true"]')) {
            return;
        }

        onMagnifyImage(imagePath);
    }, [isLayoutEditing, onMagnifyImage]);

    const renderNyraBoardBadge = () => {
        if (nyraPlayer?.characterId !== 'lieren') {
            return null;
        }

        return (
            <div
                className="absolute top-[1.7%] left-[1.6%] z-30 w-[31.4%] pointer-events-auto"
                data-testid="nyra-player-panel-anchor"
                data-player-panel-slot="player-board-image-top-left-blank"
            >
                <NyraCompanionPanel
                    player={nyraPlayer}
                    locale={locale}
                    damageResponse={nyraDamageResponse}
                    variant="boardBadge"
                />
            </div>
        );
    };

    const renderPreparedSpells = () => {
        if (characterId !== 'doctor_strange' || !preparedSpells?.length || isLayoutEditing) return null;
        return <PreparedSpellsOverlay key={preparedSpells.map(card => card.id).join('|')} preparedSpells={preparedSpells} locale={locale} onMagnifyCard={onMagnifyCard} showTouchMagnifyButton={showTouchMagnifyButton} />;
    };

    return (
        <>
            <div
                className={shellFrameClassName}
                style={{
                    left: buildBoardShellInlineUnitValue(15),
                    right: buildBoardShellInlineUnitValue(15),
                    top: buildBoardShellInlineUnitValue(-6.5),
                    ...(shellTransform.length === 0 ? {} : { transform: shellTransform }),
                }}
            >
                <div
                    className="relative flex items-center justify-center"
                    style={{ gap: buildBoardShellInlineUnitValue(boardUiTuning.centerBoardGapUnits) }}
                >
                <div
                    className={`relative w-auto shadow-2xl z-0 group transition-[outline] duration-300 overflow-visible ${isLayoutEditing ? '' : 'cursor-zoom-in'} ${coreAreaHighlighted ? 'outline outline-4 outline-dashed outline-amber-400' : ''}`}
                    style={{
                        height: buildBoardShellInlineUnitValue(playerBoardHeightUnits),
                        borderRadius: buildBoardShellInlineUnitValue(0.8),
                        outlineOffset: coreAreaHighlighted ? buildBoardShellInlineUnitValue(0.1) : undefined,
                        ...(boardUiTuning.playerBoardTranslateY === 0
                            ? {}
                            : { transform: `translateY(${buildBoardShellInlineUnitValue(boardUiTuning.playerBoardTranslateY)})` }),
                    }}
                    data-tutorial-id="player-board"
                    data-testid="player-board-surface"
                    data-character-id={characterId}
                    onClick={(event) => handleMagnifySurfaceClick(event, playerBoardPath)}
                >
                    {shouldAnimateBoardFlip ? (
                        <div
                            className="relative h-full"
                            style={{
                                width: `calc(${buildBoardShellInlineUnitValue(playerBoardHeightUnits)} * ${playerBoardAspectRatio})`,
                                perspective: '2200px',
                                WebkitPerspective: '2200px',
                                perspectiveOrigin: '50% 50%',
                                WebkitPerspectiveOrigin: '50% 50%',
                            }}
                        >
                            <motion.div
                                className="relative h-full"
                                data-testid="player-board-face-shell"
                                data-player-board-face={cursedPirateVisibleFace}
                                style={{
                                    width: '100%',
                                    transformStyle: 'preserve-3d',
                                    WebkitTransformStyle: 'preserve-3d',
                                    transformOrigin: '50% 50%',
                                }}
                                initial={false}
                                animate={true3DBoardFlipMotion}
                            >
                                <div
                                    className="absolute inset-0 overflow-hidden"
                                    style={{
                                        backfaceVisibility: 'hidden',
                                        WebkitBackfaceVisibility: 'hidden',
                                        transform: 'rotateY(0deg)',
                                        pointerEvents: cursedPirateVisibleFace === 'normal' ? 'auto' : 'none',
                                        borderRadius: buildBoardShellInlineUnitValue(0.8),
                                    }}
                                >
                                    <OptimizedImage
                                        src={cursedPirateNormalBoardPath}
                                        locale={locale}
                                        alt={t('imageAlt.playerBoard')}
                                        className="h-full w-full"
                                        placeholder={false}
                                        data-testid={cursedPirateVisibleFace === 'normal' ? 'player-board-image' : 'player-board-image-hidden'}
                                        style={{
                                            display: 'block',
                                            objectFit: 'contain',
                                            width: '100%',
                                            height: '100%',
                                        }}
                                    />
                                    {cursedPirateVisibleFace === 'normal' && (
                                        <AbilityOverlays
                                            ref={abilityOverlaysRef}
                                            isEditing={isLayoutEditing && isSelfView}
                                            availableAbilityIds={availableAbilityIds}
                                            canSelect={canSelectAbility}
                                            canHighlight={canHighlightAbility}
                                            onSelectAbility={onSelectAbility}
                                            onHighlightedAbilityClick={onHighlightedAbilityClick}
                                            selectedAbilityId={selectedAbilityId}
                                            activatingAbilityId={activatingAbilityId}
                                            abilityLevels={abilityLevels}
                                            characterId={characterId}
                                            playerBoardFace="normal"
                                            locale={locale}
                                            onMagnifyCard={onMagnifyCard}
                                            playerTokens={playerTokens}
                                        />
                                    )}
                                    {renderNyraBoardBadge()}
                                </div>
                                <div
                                    className="absolute inset-0 overflow-hidden"
                                    style={{
                                        backfaceVisibility: 'hidden',
                                        WebkitBackfaceVisibility: 'hidden',
                                        transform: 'rotateY(180deg)',
                                        pointerEvents: cursedPirateVisibleFace === 'cursed' ? 'auto' : 'none',
                                        borderRadius: buildBoardShellInlineUnitValue(0.8),
                                    }}
                                >
                                    <OptimizedImage
                                        src={cursedPirateCursedBoardPath}
                                        locale={locale}
                                        alt={t('imageAlt.playerBoard')}
                                        className="h-full w-full"
                                        placeholder={false}
                                        data-testid={cursedPirateVisibleFace === 'cursed' ? 'player-board-image' : 'player-board-image-hidden'}
                                        style={{
                                            display: 'block',
                                            objectFit: 'contain',
                                            width: '100%',
                                            height: '100%',
                                        }}
                                    />
                                    {cursedPirateVisibleFace === 'cursed' && (
                                        <AbilityOverlays
                                            ref={abilityOverlaysRef}
                                            isEditing={isLayoutEditing && isSelfView}
                                            availableAbilityIds={availableAbilityIds}
                                            canSelect={canSelectAbility}
                                            canHighlight={canHighlightAbility}
                                            onSelectAbility={onSelectAbility}
                                            onHighlightedAbilityClick={onHighlightedAbilityClick}
                                            selectedAbilityId={selectedAbilityId}
                                            activatingAbilityId={activatingAbilityId}
                                            abilityLevels={abilityLevels}
                                            characterId={characterId}
                                            playerBoardFace="cursed"
                                            locale={locale}
                                            onMagnifyCard={onMagnifyCard}
                                            playerTokens={playerTokens}
                                        />
                                    )}
                                    {renderNyraBoardBadge()}
                                </div>
                            </motion.div>
                        </div>
                    ) : (
                        <motion.div
                            className="relative h-full overflow-hidden"
                            data-testid="player-board-face-shell"
                            data-player-board-face={playerBoardFace ?? 'default'}
                            style={{
                                width: `calc(${buildBoardShellInlineUnitValue(playerBoardHeightUnits)} * ${playerBoardAspectRatio})`,
                                borderRadius: buildBoardShellInlineUnitValue(0.8),
                            }}
                            initial={{ opacity: 0.96 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.12 }}
                        >
                            <OptimizedImage
                                src={playerBoardPath}
                                locale={locale}
                                alt={t('imageAlt.playerBoard')}
                                className="h-full w-full"
                                placeholder={false}
                                data-testid="player-board-image"
                                style={{
                                    display: 'block',
                                    objectFit: 'contain',
                                    width: '100%',
                                    height: '100%',
                                }}
                            />
                            <AbilityOverlays
                                ref={abilityOverlaysRef}
                                isEditing={isLayoutEditing && isSelfView}
                                availableAbilityIds={availableAbilityIds}
                                canSelect={canSelectAbility}
                                canHighlight={canHighlightAbility}
                                onSelectAbility={onSelectAbility}
                                onHighlightedAbilityClick={onHighlightedAbilityClick}
                                selectedAbilityId={selectedAbilityId}
                                activatingAbilityId={activatingAbilityId}
                                abilityLevels={abilityLevels}
                                characterId={characterId}
                                playerBoardFace={playerBoardFace}
                                locale={locale}
                                onMagnifyCard={onMagnifyCard}
                                playerTokens={playerTokens}
                            />
                            {renderPreparedSpells()}
                            {renderNyraBoardBadge()}
                        </motion.div>
                    )}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onMagnifyImage(playerBoardPath); }}
                        className={overlayButtonClassName}
                        style={{ ...overlayButtonStyle, zIndex: UI_Z_INDEX.hud + 10 }}
                        data-testid="player-board-magnify-button"
                        data-board-magnify-ignore="true"
                        aria-label={t('actions.magnify')}
                    >
                        <span
                            className={overlayButtonVisualClassName}
                            style={overlayButtonVisualStyle}
                            data-fixed-control-visual="true"
                        >
                            <svg
                                className={`board-shell-fixed-icon ${overlayButtonIconClassName}`}
                                style={{ width: `var(--dt-board-magnify-size, ${buildBoardShellInlineUnitValue(0.72)})`, height: `var(--dt-board-magnify-size, ${buildBoardShellInlineUnitValue(0.72)})` }}
                                viewBox="0 0 20 20"
                            >
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </span>
                    </button>
                </div>
                {hasTipBoard && <div
                    className="flex items-center relative"
                    style={{ height: buildBoardShellInlineUnitValue(tipBoardHeightUnits) }}
                    data-tutorial-id="tip-board"
                >
                    <button
                        type="button"
                        onClick={onToggleTip}
                        className={tipToggleButtonClassName}
                        style={tipToggleButtonStyle}
                        data-board-magnify-ignore="true"
                    >
                        {isTipOpen ? '<' : '>'}
                    </button>
                    <div
                        className={`relative h-full transition-[width,opacity,transform] duration-500 overflow-hidden ${isTipOpen ? 'w-auto opacity-100 scale-100' : 'w-0 opacity-0 scale-95'}`}
                        style={{ borderRadius: buildBoardShellInlineUnitValue(0.8) }}
                    >
                        <div
                            className={`relative h-full group ${isLayoutEditing ? '' : 'cursor-zoom-in'}`}
                            style={{
                                width: `calc(${buildBoardShellInlineUnitValue(tipBoardHeightUnits)} * ${1311 / 2048})`,
                            }}
                            data-testid="tip-board-surface"
                            onClick={(event) => handleMagnifySurfaceClick(event, tipBoardPath)}
                        >
                            <div
                                className="w-full h-full"
                            >
                                <OptimizedImage
                                    src={tipBoardPath}
                                    locale={locale}
                                    alt={t('imageAlt.tipBoard')}
                                    className="h-full w-full"
                                    placeholder={false}
                                    data-testid="tip-board-image"
                                    style={{
                                        display: 'block',
                                        objectFit: 'contain',
                                        width: '100%',
                                        height: '100%',
                                    }}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onMagnifyImage(tipBoardPath); }}
                                className={overlayButtonClassName}
                                style={{ ...tipBoardOverlayButtonStyle, zIndex: UI_Z_INDEX.hud + 10 }}
                                data-testid="tip-board-magnify-button"
                                data-tutorial-id="tip-board-magnify-button"
                                data-board-magnify-ignore="true"
                                aria-label={t('actions.magnify')}
                            >
                                <span
                                    className={overlayButtonVisualClassName}
                                    style={overlayButtonVisualStyle}
                                    data-fixed-control-visual="true"
                                >
                                    <svg
                                        className={`board-shell-fixed-icon ${overlayButtonIconClassName}`}
                                        style={{ width: `var(--dt-board-magnify-size, ${buildBoardShellInlineUnitValue(0.72)})`, height: `var(--dt-board-magnify-size, ${buildBoardShellInlineUnitValue(0.72)})` }}
                                        viewBox="0 0 20 20"
                                    >
                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>}
                </div>
            </div>
        </>
    );
};
