import type { useQidahenTurnInput } from './useQidahenTurnInput';
import { getActionChoiceById } from '../domain/factionActionWindow';
import { ActionButton } from './QidahenFactionActionButton';

/** 势力行动本来就是抽象命令；事件和军备的入口仍由对应手牌承担。 */
export function QidahenHandActionControls({ input }: { input: ReturnType<typeof useQidahenTurnInput> }) {
    if (!input.active || input.step !== 'menu' && input.step !== 'finish-hand') return null;
    return <div className="pointer-events-auto absolute bottom-[172px] left-1/2 z-[85] flex gap-2" style={{ transform: 'translateX(-50%)' }} data-testid="qidahen-faction-actions">
        {input.handOptions.filter(option => !option.value.sourceHandCardId).map(option => {
            const action = getActionChoiceById(option.value.actionId);
            return action ? <ActionButton key={option.id} action={action} focused={false} disabled={!input.canAct || option.disabled}
                onClick={() => input.choose(option.id)} /> : null;
        })}
    </div>;
}
