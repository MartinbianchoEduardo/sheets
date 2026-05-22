import { useEffect, useRef } from 'preact/hooks';
import { subpageSignal } from '../lib/state.js';

const TITLES = { regras: 'Regras', import: 'Importar' };

// Slides over the app from the right. Hosts both Regras and Importar — exactly
// one child slot is rendered at a time. iOS-style edge swipe (~22px from the
// left) dismisses.
export function Subpage({ regras, importar }) {
  const ref = useRef(null);
  const kind = subpageSignal.value;
  const open = kind != null;

  // Edge swipe to dismiss.
  useEffect(() => {
    const sub = ref.current;
    if (!sub) return;
    let startX = 0, currentX = 0, active = false;
    const EDGE_PX = 22;

    function onStart(e) {
      if (!sub.classList.contains('open')) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_PX) { active = false; return; }
      startX = t.clientX;
      currentX = 0;
      active = true;
      sub.classList.add('dragging');
    }
    function onMove(e) {
      if (!active) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      if (dx < 0) { sub.style.transform = ''; return; }
      currentX = dx;
      sub.style.transform = `translateX(${dx}px)`;
    }
    function onEnd() {
      if (!active) return;
      active = false;
      sub.classList.remove('dragging');
      if (currentX > sub.offsetWidth * 0.3) {
        subpageSignal.value = null;
        sub.style.transform = '';
      } else {
        sub.style.transform = '';
      }
    }

    sub.addEventListener('touchstart', onStart, { passive: true });
    sub.addEventListener('touchmove', onMove, { passive: true });
    sub.addEventListener('touchend', onEnd);
    sub.addEventListener('touchcancel', onEnd);
    return () => {
      sub.removeEventListener('touchstart', onStart);
      sub.removeEventListener('touchmove', onMove);
      sub.removeEventListener('touchend', onEnd);
      sub.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  function close() { subpageSignal.value = null; }

  return (
    <div
      id="subpage"
      ref={ref}
      class={'subpage' + (open ? ' open' : '')}
      aria-hidden={open ? 'false' : 'true'}
    >
      <div class="subpage-inner">
        <header class="subpage-header">
          <button class="subpage-back" id="subpage-back" type="button" aria-label="Voltar" onClick={close}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h2 id="subpage-title">{TITLES[kind] || '—'}</h2>
        </header>
        <div class="subpage-body">
          <div id="regras-body" class={'subpage-content' + (kind === 'regras' ? '' : ' hidden')} data-subpage="regras">
            {regras}
          </div>
          <div id="import-body" class={'subpage-content' + (kind === 'import' ? '' : ' hidden')} data-subpage="import">
            {importar}
          </div>
        </div>
      </div>
    </div>
  );
}
