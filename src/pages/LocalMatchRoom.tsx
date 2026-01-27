import { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { Client } from 'boardgame.io/react';
import { GAME_IMPLEMENTATIONS } from '../games/registry';
import { GameModeProvider } from '../contexts/GameModeContext';
import { getGameById } from '../config/games.config';
import { GameHUD } from '../components/game/GameHUD';

export const LocalMatchRoom = () => {
    const { gameId } = useParams();
    const [searchParams] = useSearchParams();
    const { t, i18n } = useTranslation('lobby');

    const gameConfig = gameId ? getGameById(gameId) : undefined;

    // 从 URL 参数获取种子，如果没有则生成新的
    const seedFromUrl = searchParams.get('seed');
    const gameSeed = seedFromUrl || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    useEffect(() => {
        if (!gameId) return;
        i18n.loadNamespaces(`game-${gameId}`).catch(() => {});
    }, [gameId, i18n]);

    const LocalClient = useMemo(() => {
        if (!gameId || !GAME_IMPLEMENTATIONS[gameId]) return null;
        const impl = GAME_IMPLEMENTATIONS[gameId];
        const gameWithSeed = { ...impl.game, seed: gameSeed };
        console.log('[LocalMatch] 创建游戏，种子:', gameSeed);
        return Client({
            game: gameWithSeed,
            board: impl.board,
            debug: false,
            numPlayers: 2,
        }) as React.ComponentType<{ playerID?: string | null }>;
    }, [gameId, gameSeed]);

    if (!gameConfig) {
        return <div className="text-white">{t('matchRoom.noGame')}</div>;
    }

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
            <GameHUD mode="local" />
            <div className="w-full h-full">
                <GameModeProvider mode="local">
                    {LocalClient ? <LocalClient playerID={null} /> : (
                        <div className="w-full h-full flex items-center justify-center text-white/50">
                            {t('matchRoom.noClient')}
                        </div>
                    )}
                </GameModeProvider>
            </div>
        </div>
    );
};
