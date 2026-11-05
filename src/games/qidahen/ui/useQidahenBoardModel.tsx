import type { Props } from './boardTypes';
import { useQidahenRuntime } from './useQidahenRuntime';
import { useQidahenChoiceState } from './useQidahenChoiceState';
import { useQidahenActionCommands } from './useQidahenActionCommands';
import { useQidahenMapFocus } from './useQidahenMapFocus';

export { useQidahenRuntime } from './useQidahenRuntime';
export { useQidahenChoiceState } from './useQidahenChoiceState';
export { useQidahenActionCommands } from './useQidahenActionCommands';
export { useQidahenMapFocus } from './useQidahenMapFocus';

export function useQidahenBoardModel(props: Props) {
    const runtime = useQidahenRuntime(props);
    const choices = useQidahenChoiceState({ ...props, ...runtime });
    const commands = useQidahenActionCommands({ ...props, ...runtime, ...choices });
    const map = useQidahenMapFocus({ ...props, ...runtime, ...choices, ...commands });
    return { ...props, ...runtime, ...choices, ...commands, ...map };
}
