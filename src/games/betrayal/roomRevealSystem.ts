import type { EngineSystem } from '../../engine/systems/types';
import { TUTORIAL_COMMANDS } from '../../engine/systems/TutorialSystem';
import type { MatchState } from '../../engine/types';
import type { BetrayalCore } from './game';

// Tutorial checkpoints are a separate restoration mechanism from UndoSystem.
// Online gameplay must not accept user-authored tutorial manifests; local
// lessons may revisit only checkpoints from the same information boundary.
export function createRoomRevealSystem(): EngineSystem<BetrayalCore> {
  return {
    id: 'betrayal-room-reveal', name: '房间揭示边界', priority: 0,
    adminDebugCommandTypes: Object.values(TUTORIAL_COMMANDS),
    beforeCommand: ({ state, command }) => {
      if (!Object.values(TUTORIAL_COMMANDS).includes(command.type as typeof TUTORIAL_COMMANDS[keyof typeof TUTORIAL_COMMANDS])) return;
      const matchId = state.sys.matchId;
      if (typeof matchId === 'string' && matchId && !matchId.startsWith('local:')) {
        return { halt: true, error: '在线对局不能启动或回退本地教程。' };
      }
      if (command.type !== TUTORIAL_COMMANDS.PREVIOUS && command.type !== TUTORIAL_COMMANDS.RESTART_STEP) return;
      const sequence = state.core.roomRevealSequence ?? 0;
      if (!sequence) return;
      const tutorial = state.sys.tutorial;
      const target = tutorial.checkpoints?.filter(checkpoint => command.type === TUTORIAL_COMMANDS.RESTART_STEP
        ? checkpoint.stepIndex <= tutorial.stepIndex : checkpoint.stepIndex < tutorial.stepIndex).at(-1);
      const targetState = target?.state as MatchState<BetrayalCore> | undefined;
      if (targetState?.core.roomRevealSequence !== sequence) {
        return { halt: true, error: '房间已经公开，不能回到揭示或放置之前。' };
      }
    },
  };
}
