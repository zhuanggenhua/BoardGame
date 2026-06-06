import type {
    ManualSetupSeatDispatch,
    OnlineManualSetupSelectionBridgeProps,
} from './onlineManualSetup.types';
import {
    OnlineManualSetupSelectionBridge,
} from './onlineManualSetupSelectionBridge';

/**
 * @deprecated 旧命名仍兼容；新接入应优先使用 ManualSetupSeatDispatch。
 */
export type ManualAiSeatDispatch = ManualSetupSeatDispatch;

type OnlineManualFactionSelectionBridgeProps = Omit<
    OnlineManualSetupSelectionBridgeProps,
    'dispatchManualSetupCommand'
> & {
    dispatchManualAiCommand?: ManualAiSeatDispatch | null;
};

/**
 * @deprecated 旧命名仍兼容；新接入应优先使用 OnlineManualSetupSelectionBridge。
 */
export const OnlineManualFactionSelectionBridge = ({
    children,
    seatControllers,
    dispatchManualAiCommand,
    engineConfig,
}: OnlineManualFactionSelectionBridgeProps) => (
    <OnlineManualSetupSelectionBridge
        seatControllers={seatControllers}
        dispatchManualSetupCommand={dispatchManualAiCommand ?? null}
        engineConfig={engineConfig}
    >
        {children}
    </OnlineManualSetupSelectionBridge>
);
