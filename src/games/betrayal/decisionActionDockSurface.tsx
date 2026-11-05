import React from "react";

type BetrayalDecisionActionDockProps = {
  children: React.ReactNode;
  className?: string;
  testId?: string;
  layout?: "bottom" | "inline";
};

/** Shared action group for blocking player decisions. */
export function BetrayalDecisionActionDock({
  children,
  className = "",
  testId = "betrayal-decision-action-dock",
  layout = "bottom",
}: BetrayalDecisionActionDockProps) {
  const layoutClassName = layout === "inline"
    ? "min-h-0 items-center justify-start gap-3 border-0 bg-transparent py-0"
    : "min-h-[72px] items-center justify-center gap-4 border-t border-[rgba(214,191,129,0.18)] bg-[rgba(8,10,9,0.86)] pt-4 pb-[env(safe-area-inset-bottom)]";
  return (
    <div
      data-testid={testId}
      data-ui-role="shared-decision-action-dock"
      data-action-position={layout}
      className={`pointer-events-auto flex w-full shrink-0 ${layoutClassName} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
