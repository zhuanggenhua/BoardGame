import { useContext } from "react";
import { useInRouterContext } from "react-router-dom";
import { GameDebugPanel } from "../../components/game/framework/widgets/GameDebugPanel";
import type { GameBoardProps } from "../../engine/transport/protocol";
import { GameClientContext } from "../../engine/transport/reactContext";
import type { BetrayalCore } from "./game";
import type { BetrayalCommandMap } from "./commandTypes";
import { BETRAYAL_MANIFEST } from "./manifest";

type BetrayalDebugPanelProps = Pick<
  GameBoardProps<BetrayalCore, BetrayalCommandMap>,
  "G" | "dispatch" | "playerID"
>;

export function BetrayalDebugPanel(props: BetrayalDebugPanelProps) {
  const isInRouter = useInRouterContext();
  const gameClient = useContext(GameClientContext);
  if (!isInRouter || !gameClient) {
    return null;
  }

  return (
    <GameDebugPanel
      G={props.G}
      dispatch={gameClient.dispatch}
      playerID={props.playerID}
      aiSupport={BETRAYAL_MANIFEST.ai}
      playerOptions={BETRAYAL_MANIFEST.playerOptions}
    />
  );
}
