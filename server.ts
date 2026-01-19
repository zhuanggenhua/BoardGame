import { Server, Origins } from 'boardgame.io/server';
import { TicTacToe } from './src/games/default/game';

const server = Server({
    games: [TicTacToe],
    origins: [Origins.LOCALHOST],
});

server.run(8000);
