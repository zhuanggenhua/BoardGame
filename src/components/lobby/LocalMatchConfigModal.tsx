import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { UI_Z_INDEX } from '../../core';
import type { GameManifestEntry } from '../../games/manifest.types';
import type { AiSeatController } from '../../engine/ai';
import {
    buildLocalMatchSearchParams,
    getDefaultSeatController,
    normalizeSeatController,
    resolveLocalMatchPlayerCount,
} from '../../engine/ai/seatControllers';

interface LocalMatchConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (search: URLSearchParams) => void;
    gameManifest: GameManifestEntry;
}

export function LocalMatchConfigModal({
    isOpen,
    onClose,
    onConfirm,
    gameManifest,
}: LocalMatchConfigModalProps) {
    const { t } = useTranslation('lobby');
    const playerOptions = gameManifest.playerOptions?.length ? gameManifest.playerOptions : [2];
    const defaultPlayerCount = resolveLocalMatchPlayerCount(null, playerOptions);

    const [numPlayers, setNumPlayers] = useState(defaultPlayerCount);
    const [seatControllers, setSeatControllers] = useState<Record<string, AiSeatController>>({});

    useEffect(() => {
        if (!isOpen) return;

        const nextControllers: Record<string, AiSeatController> = {};
        for (let index = 0; index < defaultPlayerCount; index += 1) {
            nextControllers[String(index)] = getDefaultSeatController(index, defaultPlayerCount, gameManifest.ai);
        }
        setNumPlayers(defaultPlayerCount);
        setSeatControllers(nextControllers);
    }, [defaultPlayerCount, gameManifest.ai, isOpen]);

    const seatIds = useMemo(
        () => Array.from({ length: numPlayers }, (_, index) => String(index)),
        [numPlayers],
    );

    const updateSeatController = (playerId: string, controller: AiSeatController) => {
        setSeatControllers((prev) => ({
            ...prev,
            [playerId]: normalizeSeatController(controller, gameManifest.ai),
        }));
    };

    const handlePlayerCountChange = (nextNumPlayers: number) => {
        setNumPlayers(nextNumPlayers);
        setSeatControllers((prev) => {
            const next: Record<string, AiSeatController> = {};
            for (let index = 0; index < nextNumPlayers; index += 1) {
                next[String(index)] = prev[String(index)]
                    ? normalizeSeatController(prev[String(index)], gameManifest.ai)
                    : getDefaultSeatController(index, nextNumPlayers, gameManifest.ai);
            }
            return next;
        });
    };

    const handleConfirm = () => {
        const search = buildLocalMatchSearchParams({
            numPlayers,
            playerOptions,
            aiSupport: gameManifest.ai,
            seatControllers,
        });
        onConfirm(search);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        style={{ zIndex: UI_Z_INDEX.modalOverlay }}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed inset-0 flex items-center justify-center p-4 sm:p-8 pointer-events-none"
                        style={{ zIndex: UI_Z_INDEX.modalContent }}
                    >
                        <div
                            data-testid="local-match-config-modal"
                            className="bg-parchment-card-bg pointer-events-auto w-full max-w-2xl rounded-sm shadow-parchment-card-hover border border-parchment-card-border/30 relative overflow-hidden font-serif"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-parchment-card-border/60" />
                            <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-parchment-card-border/60" />
                            <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-parchment-card-border/60" />
                            <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-parchment-card-border/60" />

                            <div className="p-6 pb-3">
                                <h2 className="text-xl font-bold text-parchment-base-text tracking-wide text-center">
                                    {t('ai.configureTitle')}
                                </h2>
                                <p className="mt-2 text-center text-sm leading-6 text-parchment-light-text">
                                    {t('ai.configureHint')}
                                </p>
                            </div>

                            <div className="px-6 pb-6 space-y-5">
                                {playerOptions.length > 1 && (
                                    <div>
                                        <label className="block text-sm font-bold text-parchment-base-text mb-2">
                                            {t('ai.playerCount')}
                                        </label>
                                        <div className="flex gap-2 flex-wrap">
                                            {playerOptions.map((count) => (
                                                <button
                                                    key={count}
                                                    type="button"
                                                    onClick={() => handlePlayerCountChange(count)}
                                                    className={clsx(
                                                        'px-4 py-2 rounded-[4px] text-sm font-bold transition-all cursor-pointer border',
                                                        numPlayers === count
                                                            ? 'bg-parchment-base-text text-parchment-card-bg border-parchment-base-text'
                                                            : 'bg-parchment-card-bg text-parchment-base-text border-parchment-card-border/30 hover:bg-parchment-base-bg',
                                                    )}
                                                >
                                                    {t('createRoom.playerCountUnit', { count })}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid gap-3 md:grid-cols-2">
                                    {seatIds.map((playerId, index) => {
                                        const controller = seatControllers[playerId]
                                            ?? getDefaultSeatController(index, numPlayers, gameManifest.ai);
                                        return (
                                            <div
                                                key={playerId}
                                                className="rounded-[6px] border border-parchment-card-border/25 bg-parchment-base-bg/35 p-4 space-y-3"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <h3 className="text-sm font-bold text-parchment-base-text">
                                                        {t('ai.seat', { seat: index })}
                                                    </h3>
                                                    <span className="text-[10px] uppercase tracking-[0.14em] text-parchment-light-text">
                                                        {index === 0 ? t('ai.primarySeat') : t('ai.secondarySeat')}
                                                    </span>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateSeatController(playerId, { type: 'human' })}
                                                        className={clsx(
                                                            'px-3 py-1.5 rounded-[4px] text-xs font-bold border transition-all cursor-pointer',
                                                            controller.type === 'human'
                                                                ? 'bg-parchment-base-text text-parchment-card-bg border-parchment-base-text'
                                                                : 'bg-parchment-card-bg text-parchment-base-text border-parchment-card-border/30 hover:bg-parchment-base-bg',
                                                        )}
                                                    >
                                                        {t('ai.controllers.human')}
                                                    </button>
                                                    {gameManifest.ai.localAi && (
                                                        <button
                                                            type="button"
                                                            onClick={() => updateSeatController(playerId, { type: 'local-ai' })}
                                                            className={clsx(
                                                                'px-3 py-1.5 rounded-[4px] text-xs font-bold border transition-all cursor-pointer',
                                                                controller.type === 'local-ai'
                                                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                                                    : 'bg-parchment-card-bg text-parchment-base-text border-parchment-card-border/30 hover:bg-parchment-base-bg',
                                                            )}
                                                        >
                                                            {t('ai.controllers.local')}
                                                        </button>
                                                    )}
                                                    {gameManifest.ai.remoteAi && (
                                                        <button
                                                            type="button"
                                                            onClick={() => updateSeatController(playerId, { type: 'remote-ai', providerId: 'astrbot' })}
                                                            className={clsx(
                                                                'px-3 py-1.5 rounded-[4px] text-xs font-bold border transition-all cursor-pointer',
                                                                controller.type === 'remote-ai'
                                                                    ? 'bg-amber-500 text-white border-amber-500'
                                                                    : 'bg-parchment-card-bg text-parchment-base-text border-parchment-card-border/30 hover:bg-parchment-base-bg',
                                                            )}
                                                        >
                                                            {t('ai.controllers.remote')}
                                                        </button>
                                                    )}
                                                </div>

                                                {controller.type === 'local-ai' && (
                                                    <div className="space-y-1">
                                                        <label className="block text-[11px] font-bold text-parchment-light-text">
                                                            {t('ai.policyId')}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={controller.policyId ?? ''}
                                                            onChange={(event) => updateSeatController(playerId, {
                                                                type: 'local-ai',
                                                                policyId: event.target.value,
                                                            })}
                                                            placeholder={t('ai.policyPlaceholder')}
                                                            className="w-full px-3 py-2 rounded-[4px] text-sm border border-parchment-card-border/30 bg-parchment-card-bg text-parchment-base-text placeholder:text-parchment-light-text/50 focus:outline-none focus:border-parchment-base-text transition-colors"
                                                        />
                                                    </div>
                                                )}

                                                {controller.type === 'remote-ai' && (
                                                    <div className="space-y-1">
                                                        <label className="block text-[11px] font-bold text-parchment-light-text">
                                                            {t('ai.providerId')}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={controller.providerId}
                                                            onChange={(event) => updateSeatController(playerId, {
                                                                type: 'remote-ai',
                                                                providerId: event.target.value,
                                                            })}
                                                            placeholder={t('ai.providerPlaceholder')}
                                                            className="w-full px-3 py-2 rounded-[4px] text-sm border border-parchment-card-border/30 bg-parchment-card-bg text-parchment-base-text placeholder:text-parchment-light-text/50 focus:outline-none focus:border-parchment-base-text transition-colors"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="rounded-[6px] border border-dashed border-parchment-card-border/40 bg-parchment-base-bg/30 px-4 py-3 text-xs leading-6 text-parchment-light-text">
                                    {t('ai.quickStart')}
                                </div>
                            </div>

                            <div className="p-6 pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-2.5 px-4 bg-parchment-card-bg border border-parchment-card-border/30 text-parchment-base-text font-bold rounded-[4px] hover:bg-parchment-base-bg transition-all cursor-pointer"
                                >
                                    {t('actions.cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirm}
                                    className="flex-1 py-2.5 px-4 bg-parchment-base-text text-parchment-card-bg font-bold rounded-[4px] hover:bg-parchment-brown transition-all cursor-pointer"
                                >
                                    {t('ai.startLocal')}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
