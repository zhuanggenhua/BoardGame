export interface MobileEvidenceScenarioContext {
    sleep: (ms: number) => Promise<void>;
    waitForCondition: (
        label: string,
        check: () => boolean | Promise<boolean>,
        timeoutMs?: number,
        intervalMs?: number,
    ) => Promise<void>;
    getVisibleElement: (selector: string) => HTMLElement | null;
    getVisibleElements: (selector: string) => HTMLElement[];
    clickElement: (selector: string, visibleOnly?: boolean) => boolean;
    longPressElement: (selector: string, label: string, pointerId: number) => Promise<void>;
    waitForMagnifyOverlayReady: (overlaySelector: string, label: string) => Promise<void>;
    openFabPanel: (panelId: string, mainId?: string) => Promise<void>;
}

export type MobileEvidenceScenarioHandler = (
    context: MobileEvidenceScenarioContext,
) => Promise<void>;

export type MobileEvidenceScenarioHandlers = Record<string, MobileEvidenceScenarioHandler>;
