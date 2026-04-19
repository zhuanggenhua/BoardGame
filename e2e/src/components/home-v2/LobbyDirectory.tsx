import type { GameConfig } from '../../config/games.config';
import { GameListCard } from '../lobby/GameList';

function BookGamePage({
    games,
    onSelect,
}: {
    games: GameConfig[];
    onSelect: (id: string) => void;
}) {
    const slots = Array.from({ length: 9 }, (_, index) => games[index] ?? null);

    return (
        <div
            className="grid h-full w-full place-items-center gap-x-[3.5%] gap-y-[5%] px-[4.5%] py-[5%] pointer-events-auto"
            style={{
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
            }}
        >
            {slots.map((game, index) => (game ? (
                <GameListCard
                    key={game.id}
                    game={game}
                    index={index}
                    onGameClick={onSelect}
                    variant="homeV2Compact"
                    className="max-w-[62px]"
                />
            ) : (
                <div key={`placeholder-${index}`} className="h-full w-full" aria-hidden="true" />
            )))}
        </div>
    );
}

export interface OverviewProps {
    games: GameConfig[];
    onGameClick: (id: string) => void;
}

export const Overview = ({ games, onGameClick }: OverviewProps) => {
    return (
        <div className="h-full w-full pointer-events-auto">
            <BookGamePage games={games} onSelect={onGameClick} />
        </div>
    );
};

export interface LeftProps {
    games: GameConfig[];
    onGameClick: (id: string) => void;
}

export const Left = ({ games, onGameClick }: LeftProps) => {
    return <BookGamePage games={games} onSelect={onGameClick} />;
};

export interface RightProps {
    games: GameConfig[];
    onGameClick: (id: string) => void;
}

export const Right = ({ games, onGameClick }: RightProps) => {
    return <BookGamePage games={games} onSelect={onGameClick} />;
};

export const LobbyDirectory = {
    Overview,
    Left,
    Right,
};
