import { selectedTabSignal, TAB_ORDER, setTab } from '../lib/state.js';

const LABELS = {
  add: '+ Novo',
  history: 'Hist',
  summary: 'Resumo',
  painel: 'Painel',
  config: 'Config',
};

export function Tabs() {
  const active = selectedTabSignal.value;
  return (
    <div class="tabs">
      {TAB_ORDER.map(name => (
        <button
          key={name}
          class={'tab' + (active === name ? ' active' : '')}
          data-tab={name}
          type="button"
          onClick={() => setTab(name)}
        >
          {LABELS[name]}
        </button>
      ))}
    </div>
  );
}
