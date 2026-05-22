import { useEffect, useRef, useState } from 'preact/hooks';
import { formatBRL, formatDate, parseValor, wireValorMask } from '../lib/format.js';
import { subpageSignal } from '../lib/state.js';
import { useSettings, useUpdateSettings } from '../hooks/useSettings.js';
import { useFaturas, useCreateFatura, useUpdateFatura, useDeleteFatura } from '../hooks/useFaturas.js';
import { useToast } from '../components/Toast.jsx';

function ActionCards() {
  return (
    <div class="config-actions">
      <button type="button" class="action-card" onClick={() => { subpageSignal.value = 'import'; }}>
        <div class="ac-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div class="ac-body">
          <div class="ac-title">Importar</div>
          <div class="ac-sub">Carregar CSV do cartão</div>
        </div>
        <div class="ac-chev">›</div>
      </button>
      <button type="button" class="action-card" onClick={() => { subpageSignal.value = 'regras'; }}>
        <div class="ac-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <circle cx="7" cy="7" r="1.4" fill="currentColor" />
          </svg>
        </div>
        <div class="ac-body">
          <div class="ac-title">Regras</div>
          <div class="ac-sub">Mapear merchant → categoria</div>
        </div>
        <div class="ac-chev">›</div>
      </button>
    </div>
  );
}

function SettingsForm({ settings, faturas }) {
  const toast = useToast();
  const update = useUpdateSettings();
  const reservaRef = useRef(null);

  const [meta, setMeta] = useState(String(Math.round((settings.meta_investimento_pct || 0) * 100)));
  const [reserva, setReserva] = useState(((settings.reserva_atual_cents || 0) / 100).toFixed(2).replace('.', ','));
  const [mult, setMult] = useState(String(settings.reserva_meta_multiplier ?? 0));
  const [taxa, setTaxa] = useState(((settings.taxa_juros_mensal_pct || 0) * 100).toFixed(2));
  const [fechamento, setFechamento] = useState(String(settings.fechamento_dia ?? 31));
  const [override, setOverride] = useState(settings.current_fatura_override_id ?? '');

  useEffect(() => { wireValorMask(reservaRef.current); }, []);

  async function onSave() {
    const patch = {};
    const metaPct = Number(meta);
    if (!isNaN(metaPct)) patch.meta_investimento_pct = Math.max(0, Math.min(1, metaPct / 100));
    const reservaValor = parseValor(reserva);
    if (!isNaN(reservaValor)) patch.reserva_atual_cents = Math.round(reservaValor * 100);
    const m = Number(mult);
    if (!isNaN(m)) patch.reserva_meta_multiplier = m;
    const t = Number(taxa);
    if (!isNaN(t)) patch.taxa_juros_mensal_pct = t / 100;
    const f = parseInt(fechamento, 10);
    if (Number.isInteger(f)) patch.fechamento_dia = f;
    patch.current_fatura_override_id = override === '' ? null : Number(override);

    try {
      await update.mutateAsync(patch);
      toast('Configurações salvas ✓', 'ok');
    } catch (err) {
      if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
    }
  }

  return (
    <div class="config-section">
      <h3>Geral</h3>
      <div class="config-row">
        <span class="lbl">Meta de investimento</span>
        <input id="cfg-meta" type="number" inputmode="decimal" step="1" min="0" max="100"
          value={meta} onInput={(e) => setMeta(e.currentTarget.value)} />
        <span class="hint">% do salário</span>
      </div>
      <div class="config-row">
        <span class="lbl">Reserva atual</span>
        <input id="cfg-reserva" type="text" inputmode="decimal"
          ref={reservaRef}
          value={reserva} onInput={(e) => setReserva(e.currentTarget.value)} />
        <span class="hint">em reais</span>
      </div>
      <div class="config-row">
        <span class="lbl">Multiplicador da meta</span>
        <input id="cfg-meta-mult" type="number" inputmode="decimal" step="0.5" min="0"
          value={mult} onInput={(e) => setMult(e.currentTarget.value)} />
        <span class="hint">meta = gasto fixo × multiplicador</span>
      </div>
      <div class="config-row">
        <span class="lbl">Taxa juros mensal</span>
        <input id="cfg-taxa" type="number" inputmode="decimal" step="0.01"
          value={taxa} onInput={(e) => setTaxa(e.currentTarget.value)} />
        <span class="hint">% ao mês (para projeção)</span>
      </div>
      <div class="config-row">
        <span class="lbl">Dia de fechamento</span>
        <input id="cfg-fechamento" type="number" inputmode="numeric" min="1" max="31"
          value={fechamento} onInput={(e) => setFechamento(e.currentTarget.value)} />
        <span class="hint">dia que a fatura fecha</span>
      </div>
      <div class="config-row">
        <span class="lbl">Fatura atual</span>
        <select id="cfg-override"
          value={override}
          onChange={(e) => setOverride(e.currentTarget.value)}>
          <option value="">auto (hoje)</option>
          {faturas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
        <span class="hint">"auto (hoje)" segue a data</span>
      </div>
      <div class="config-btn-row">
        <button class="config-btn" type="button" disabled={update.isPending} onClick={onSave}>
          {update.isPending ? 'salvando...' : 'salvar'}
        </button>
      </div>
    </div>
  );
}

function FaturaEditFields({ nome, setNome, startDate, setStartDate, salStr, setSalStr }) {
  const salRef = useRef(null);
  useEffect(() => { wireValorMask(salRef.current); }, []);
  return (
    <div class="fatura-edit">
      <div class="field full">
        <label>Nome da fatura</label>
        <input class="f-nome" maxLength={40} placeholder="Ex: Julho 2026"
          value={nome} onInput={(e) => setNome(e.currentTarget.value)} />
      </div>
      <div class="field">
        <label>Início do ciclo</label>
        <input class="f-start" type="date"
          value={startDate} onInput={(e) => setStartDate(e.currentTarget.value)} />
        <span class="hint">primeiro dia da fatura</span>
      </div>
      <div class="field">
        <label>Salário líquido</label>
        <input class="f-salario" inputmode="decimal" placeholder="0,00"
          ref={salRef}
          value={salStr} onInput={(e) => setSalStr(e.currentTarget.value)} />
        <span class="hint">em reais</span>
      </div>
    </div>
  );
}

function FaturaEditingRow({ fatura, onClose }) {
  const toast = useToast();
  const update = useUpdateFatura();
  const del = useDeleteFatura();

  const [nome, setNome] = useState(fatura.nome);
  const [startDate, setStartDate] = useState(fatura.start_date);
  const [salStr, setSalStr] = useState((fatura.salario_cents / 100).toFixed(2).replace('.', ','));

  async function onSave() {
    if (!nome.trim()) return toast('Informe o nome', 'err');
    if (!startDate)   return toast('Informe a data de início', 'err');
    const salNum = salStr.trim() ? parseValor(salStr) : 0;
    if (isNaN(salNum)) return toast('Salário inválido', 'err');
    try {
      await update.mutateAsync({
        id: fatura.id, nome: nome.trim(), start_date: startDate,
        salario_cents: Math.round(salNum * 100),
      });
      onClose();
      toast('Fatura atualizada ✓', 'ok');
    } catch (err) {
      if (err.message === 'duplicate_fatura_name') toast('Nome de fatura já existe', 'err');
      else if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
    }
  }

  async function onDelete() {
    if (!window.confirm('Excluir esta fatura?')) return;
    try {
      await del.mutateAsync(fatura.id);
      onClose();
      toast('Fatura excluída', 'ok');
    } catch (err) {
      if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
    }
  }

  return (
    <div class="fatura-row editing" data-id={fatura.id}>
      <FaturaEditFields
        nome={nome} setNome={setNome}
        startDate={startDate} setStartDate={setStartDate}
        salStr={salStr} setSalStr={setSalStr}
      />
      <div class="config-btn-row" style={{ justifyContent: 'flex-start' }}>
        <button class="config-btn" type="button" onClick={onSave}>salvar</button>
        <button class="config-btn danger" type="button" onClick={onDelete}>excluir</button>
        <button class="config-btn muted" type="button" onClick={onClose}>cancelar</button>
      </div>
    </div>
  );
}

function FaturaNewRow({ onClose }) {
  const toast = useToast();
  const create = useCreateFatura();
  const [nome, setNome] = useState('');
  const [startDate, setStartDate] = useState('');
  const [salStr, setSalStr] = useState('');

  async function onCreate() {
    if (!nome.trim()) return toast('Informe o nome', 'err');
    if (!startDate)   return toast('Informe a data de início', 'err');
    const salNum = salStr.trim() ? parseValor(salStr) : 0;
    if (isNaN(salNum)) return toast('Salário inválido', 'err');
    try {
      await create.mutateAsync({
        nome: nome.trim(), start_date: startDate,
        salario_cents: Math.round(salNum * 100),
      });
      onClose();
      toast('Fatura adicionada ✓', 'ok');
    } catch (err) {
      if (err.message === 'duplicate_fatura_name') toast('Nome de fatura já existe', 'err');
      else if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
    }
  }

  return (
    <div class="fatura-row editing" data-id="new">
      <FaturaEditFields
        nome={nome} setNome={setNome}
        startDate={startDate} setStartDate={setStartDate}
        salStr={salStr} setSalStr={setSalStr}
      />
      <div class="config-btn-row" style={{ justifyContent: 'flex-start' }}>
        <button class="config-btn" type="button" onClick={onCreate}>adicionar</button>
        <button class="config-btn muted" type="button" onClick={onClose}>cancelar</button>
      </div>
    </div>
  );
}

function FaturasSection({ faturas }) {
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  return (
    <div class="config-section">
      <h3>Faturas</h3>
      <div id="config-faturas">
        {faturas.map(f => (
          editingId === f.id
            ? <FaturaEditingRow key={f.id} fatura={f} onClose={() => setEditingId(null)} />
            : (
              <div key={f.id} class="fatura-row" data-id={f.id}>
                <div class="nome">{f.nome}</div>
                <div class="actions">
                  <button class="config-btn" type="button" onClick={() => setEditingId(f.id)}>editar</button>
                </div>
                <div class="meta">início {formatDate(f.start_date)} · salário {formatBRL(f.salario_cents)}</div>
              </div>
            )
        ))}
      </div>
      {adding
        ? <FaturaNewRow onClose={() => setAdding(false)} />
        : (
          <div class="config-btn-row" style={{ justifyContent: 'flex-start' }}>
            <button class="config-btn" type="button" onClick={() => setAdding(true)}>+ nova fatura</button>
          </div>
        )}
    </div>
  );
}

export function ConfigView() {
  const settingsQ = useSettings();
  const { data: faturas = [] } = useFaturas();
  const settings = settingsQ.data;

  return (
    <section id="view-config" class="deck-page">
      <div id="config-body">
        <ActionCards />
        {settingsQ.isLoading && !settings && <div class="empty">Carregando...</div>}
        {settingsQ.isError && <div class="empty">Erro: {String(settingsQ.error?.message || settingsQ.error)}</div>}
        {settings && (
          <>
            <SettingsForm key={settings.updated_at} settings={settings} faturas={faturas} />
            <FaturasSection faturas={faturas} />
          </>
        )}
      </div>
    </section>
  );
}
