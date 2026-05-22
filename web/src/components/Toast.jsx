import { toastSignal, showToast } from '../lib/state.js';

export function useToast() {
  return showToast;
}

export function Toast() {
  const t = toastSignal.value;
  const cls = 'toast' + (t ? ' show ' + (t.kind || '') : '');
  return (
    <div id="toast" class={cls}>
      {t && (
        <>
          <span>{t.msg}</span>
          {t.action && t.action.label && typeof t.action.onClick === 'function' && (
            <button
              class="toast-action"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toastSignal.value = null;
                t.action.onClick();
              }}
            >
              {t.action.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}
