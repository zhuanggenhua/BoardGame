import React from "react";

type BetrayalDecisionActionDockProps = {
  children: React.ReactNode;
  className?: string;
  testId?: string;
};

/** Shared bottom action rail for blocking player decisions. */
export function BetrayalDecisionActionDock({
  children,
  className = "",
  testId = "betrayal-decision-action-dock",
}: BetrayalDecisionActionDockProps) {
  return (
    <div
      data-testid={testId}
      data-ui-role="shared-decision-action-dock"
      data-action-position="bottom"
      className={`pointer-events-auto flex min-h-[72px] w-full shrink-0 items-center justify-center gap-4 border-t border-[rgba(214,191,129,0.18)] bg-[rgba(8,10,9,0.86)] pt-4 pb-[env(safe-area-inset-bottom)] ${className}`.trim()}
    >
      {children}
    </div>
  );
}
