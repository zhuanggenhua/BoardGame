import React from 'react';
import type { BoardProps } from 'boardgame.io/react';
import type { MatchState } from '../../engine/types';
import type { SmashUpCore } from './domain';

type Props = BoardProps<MatchState<SmashUpCore>>;

const SmashUpBoard: React.FC<Props> = () => {
    return (
        <div className="flex h-full items-center justify-center bg-slate-900 text-white">
            大杀四方 - 开发中
        </div>
    );
};

export default SmashUpBoard;
