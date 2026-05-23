import { useQueryClient } from '@tanstack/react-query';
import { currentFaturaIdSignal } from '../lib/state.js';
import { useFaturas } from '../hooks/useFaturas.js';
import { useCurrentFatura } from '../hooks/useCurrentFatura.js';
import { isoToday, resolveFaturaForDateClient } from '../lib/format.js';

// Fires when today's resolved fatura is strictly newer than the one the user
// is currently in, AND they haven't pinned a fatura via override.
export function RolloverBanner() {
  const qc = useQueryClient();
  const { data: faturas = [] } = useFaturas();
  const { data: current } = useCurrentFatura();

  if (current?.override_set) return null;

  const today = isoToday();
  const todayFatura = resolveFaturaForDateClient(today, faturas);
  if (!todayFatura) return null;

  // Wait for the signal to hydrate from /api/faturas/current; otherwise the
  // banner flashes on first load before Shell's effect fills it in.
  const currentId = currentFaturaIdSignal.value;
  if (currentId == null) return null;
  if (currentId === todayFatura.id) return null;

  const currentRow = faturas.find(f => f.id === currentId);
  if (currentRow && currentRow.start_date >= todayFatura.start_date) return null;

  function onTrocar() {
    currentFaturaIdSignal.value = todayFatura.id;
    qc.invalidateQueries({ queryKey: ['faturas', 'current'] });
  }

  return (
    <div id="rollover" class="rollover">
      <div class="msg">Nova fatura: <strong id="rollover-name">{todayFatura.nome}</strong></div>
      <button id="rollover-btn" type="button" onClick={onTrocar}>Trocar</button>
    </div>
  );
}
