import { Client } from 'boardgame.io/react';
import { TicTacToe } from './games/default/game';
import { TicTacToeBoard } from './games/default/Board';
import { DebugProvider, useDebug } from './contexts/DebugContext';

const GameClient = Client({
  game: TicTacToe,
  board: TicTacToeBoard,
  debug: false, // 隐藏右侧原生调试面板，使用自定义面板
});

const GameRoot = () => {
  const { playerID } = useDebug();
  return (
    <>
      {/* Pass playerID to Client to control the view */}
      <GameClient playerID={playerID} />
    </>
  );
};

const App = () => {
  return (
    <DebugProvider>
      <GameRoot />
    </DebugProvider>
  );
};

export default App;
