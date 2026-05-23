import { currentFaturaIdSignal, historyCategoriasSignal, setTab } from '../lib/state.js';
import { useOutroCount } from '../hooks/useOutroCount.js';

export function Header() {
  const faturaId = currentFaturaIdSignal.value;
  const { data: count = 0 } = useOutroCount(faturaId);
  const visible = count > 0;

  function onBadge() {
    historyCategoriasSignal.value = ['Outro'];
    setTab('history');
  }

  return (
    <header>
      <div class="brand">gastos<em>.</em></div>
      <div class="header-right">
        <button
          id="outro-badge"
          class={'outro-badge' + (visible ? ' visible' : '')}
          type="button"
          title="Lançamentos sem categoria"
          onClick={onBadge}
        >
          <span id="outro-count">{count}</span>
          <span>outros</span>
        </button>
        <div class="status-dot ok" id="status-dot" title="Status da conexão" />
      </div>
    </header>
  );
}
