/** A bfcache page is frozen, not destroyed. Do not dispose its live scene. */
export function bindPageLifecycle(target, study) {
  let disposed = false;
  function onHide(event) {
    if (event.persisted || disposed) return;
    disposed = true;
    target.removeEventListener('pagehide', onHide);
    target.removeEventListener('pageshow', onShow);
    study.dispose();
  }
  function onShow(event) {
    if (event.persisted && !disposed) study.resize();
  }
  target.addEventListener('pagehide', onHide);
  target.addEventListener('pageshow', onShow);
  return () => {
    target.removeEventListener('pagehide', onHide);
    target.removeEventListener('pageshow', onShow);
  };
}
