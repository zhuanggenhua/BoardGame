import React from "react";
import { createPortal } from "react-dom";

export function BetrayalScreenFeedback({ children }: { children: React.ReactNode }) {
  const sourceRef = React.useRef<HTMLSpanElement>(null);
  const feedbackRef = React.useRef<HTMLSpanElement>(null);
  const [layer, setLayer] = React.useState<HTMLElement | null>(null);

  React.useLayoutEffect(() => {
    const grid = sourceRef.current?.closest('[data-testid="betrayal-room-grid"]');
    setLayer(grid?.querySelector<HTMLElement>("[data-betrayal-screen-feedback]") ?? null);
  }, []);

  React.useLayoutEffect(() => {
    const source = sourceRef.current?.closest<HTMLElement>("[data-scene-figure-id]");
    const feedback = feedbackRef.current;
    if (!source || !feedback || !layer) return;
    let frame = 0;
    const update = () => {
      const view = layer.getBoundingClientRect();
      const nativeFigure = source.hasAttribute("data-three-model");
      const token = nativeFigure ? null : source.getBoundingClientRect();
      const bounds = token ? [token.left, token.top, token.right, token.bottom]
        : source.dataset.tutorialScreenBounds?.split(",").map(Number);
      const visible = !source.closest("[inert]") && bounds?.length === 4 && bounds.every(Number.isFinite)
        && bounds[2] > view.left && bounds[0] < view.right
        && bounds[3] > view.top && bounds[1] < view.bottom
        && view.width > 0 && view.height > 0;
      feedback.style.visibility = visible ? "visible" : "hidden";
      if (visible && bounds) {
        const anchorY = nativeFigure ? Number(source.dataset.screenFeedbackAnchorY) : bounds[1];
        feedback.style.left = `${((bounds[0] + bounds[2]) / 2 - view.left) / view.width * 100}%`;
        feedback.style.top = `${((Number.isFinite(anchorY) ? anchorY : bounds[1]) - view.top) / view.height * 100}%`;
      }
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [layer]);

  return (
    <>
      <span ref={sourceRef} hidden />
      {layer && createPortal(
        <span ref={feedbackRef} className="betrayal-screen-feedback-label">{children}</span>,
        layer,
      )}
    </>
  );
}
