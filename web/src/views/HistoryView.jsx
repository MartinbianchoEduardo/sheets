import { useEffect, useRef, useState } from 'preact/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { CATEGORIES } from '../lib/categories.js';
import { formatBRL, formatDate, parseValor, wireValorMask, resolveFaturaForDateClient, guessChaveFromDescricao } from '../lib/format.js';
import { historyCategoriaSignal } from '../lib/state.js';
import { api } from '../lib/api.js';
import { useFaturas } from '../hooks/useFaturas.js';
import {
  useTransactions, useUpdateTransaction, useDeleteTransaction, useRestoreTransaction,
} from '../hooks/useTransactions.js';
import { useCreateRule } from '../hooks/useRules.js';
import { useToast } from '../components/Toast.jsx';

function faturaNameById(faturas, id) {
  if (id == null) return '';
  const f = faturas.find(x => x.id === id);
  return f ? f.nome : '';
}

// Long-press 500ms → opens the row's editor. Movement cancels (so deck swipes
// never accidentally trigger edit mode).
function useLongPress(onTrigger) {
  const timer = useRef(null);
  const start = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(onTrigger, 500);
  };
  const cancel = () => clearTimeout(timer.current);
  return {
    onTouchStart: start, onTouchEnd: cancel, onTouchCancel: cancel, onTouchMove: cancel,
    onMouseDown: start, onMouseUp: cancel, onMouseLeave: cancel,
  };
}

function DisplayRow({ row, faturas, onLongPress }) {
  const press = useLongPress(onLongPress);
  return (
    <div class="entry" data-id={row.id} {...press}>
      <div class="entry-desc">{row.descricao}</div>
      <div class="entry-valor">{formatBRL(row.valor_cents)}</div>
      <div class="entry-meta">
        <span>{formatDate(row.data)}</span>
        <span class="entry-cat">{row.categoria}</span>
        <span>{faturaNameById(faturas, row.fatura_id)}</span>
      </div>
    </div>
  );
}

// After categorizing an Outro row to something else, offer to remember the
// merchant. Skipped silently if the guessed chave is already covered.
async function maybePromptAddRule({ qc, createRule, toast, descricao, categoria }) {
  if (!descricao || !categoria || categoria === 'Outro') return;
  const guess = guessChaveFromDescricao(descricao);
  if (!guess) return;
  let rules = qc.getQueryData(['rules']);
  if (!Array.isArray(rules)) {
    try { rules = (await api('rules/list', {})).rules || []; qc.setQueryData(['rules'], rules); }
    catch { return; }
  }
  if (rules.some(r => guess.includes(String(r.chave || '').toLowerCase()))) return;
  toast(`Adicionar regra "${guess}" → ${categoria}?`, 'ok', {
    label: 'sim',
    onClick: async () => {
      try {
        await createRule.mutateAsync({ chave: guess, categoria });
        toast('Regra adicionada ✓', 'ok');
      } catch (err) {
        if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
      }
    },
  });
}

function EditingRow({ row, faturas, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const update = useUpdateTransaction();
  const del = useDeleteTransaction();
  const restore = useRestoreTransaction();
  const createRule = useCreateRule();
  const valorRef = useRef(null);

  const [descricao, setDescricao] = useState(row.descricao);
  const [valor, setValor] = useState((row.valor_cents / 100).toFixed(2).replace('.', ','));
  const [data, setData] = useState(row.data);
  const [categoria, setCategoria] = useState(row.categoria);

  useEffect(() => { wireValorMask(valorRef.current); }, []);
  useEffect(() => {
    const el = document.querySelector(`.entry.editing[data-id="${row.id}"] .edit-desc`);
    el?.focus();
  }, [row.id]);

  const faturaForDate = resolveFaturaForDateClient(data, faturas);
  const faturaName = faturaForDate ? faturaForDate.nome : '—';

  async function onSave() {
    if (!descricao.trim()) return toast('Informe a descrição', 'err');
    if (!valor.trim())     return toast('Informe o valor', 'err');
    if (!data)             return toast('Informe a data', 'err');
    if (!categoria)        return toast('Escolha uma categoria', 'err');
    const v = parseValor(valor);
    if (isNaN(v)) return toast('Valor inválido', 'err');
    const prevCategoria = row.categoria;
    try {
      await update.mutateAsync({
        id: row.id,
        descricao: descricao.trim(),
        valor_cents: Math.round(v * 100),
        data,
        categoria,
      });
      onClose();
      toast('Atualizado ✓', 'ok');
      if (prevCategoria === 'Outro' && categoria !== 'Outro') {
        maybePromptAddRule({ qc, createRule, toast, descricao: descricao.trim(), categoria });
      }
    } catch (err) {
      if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
    }
  }

  async function onDelete() {
    onClose();
    try {
      await del.mutateAsync(row.id);
    } catch (err) {
      if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
      return;
    }
    toast('Lançamento excluído', 'ok', {
      label: 'desfazer',
      onClick: async () => {
        try {
          await restore.mutateAsync(row.id);
          toast('Restaurado ✓', 'ok');
        } catch (err) {
          if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
        }
      },
    });
  }

  return (
    <div class="entry editing" data-id={row.id}>
      <div class="edit-row">
        <input
          class="edit-desc"
          maxLength={200}
          value={descricao}
          onInput={(e) => setDescricao(e.currentTarget.value)}
        />
      </div>
      <div class="edit-row">
        <input
          class="edit-valor"
          inputmode="decimal"
          ref={valorRef}
          value={valor}
          onInput={(e) => setValor(e.currentTarget.value)}
        />
        <input
          class="edit-data"
          type="date"
          value={data}
          onInput={(e) => setData(e.currentTarget.value)}
        />
      </div>
      <div class="edit-fatura">{faturaName}</div>
      <div class="edit-chips">
        {CATEGORIES.map(c => (
          <button
            key={c}
            type="button"
            class={'chip' + (categoria === c ? ' selected' : '')}
            onClick={() => setCategoria(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div class="edit-actions">
        <button class="edit-action" type="button" onClick={onSave}>salvar</button>
        <button class="edit-action danger" type="button" onClick={onDelete}>excluir</button>
        <button class="edit-action muted" type="button" onClick={onClose}>cancelar</button>
      </div>
    </div>
  );
}

export function HistoryView() {
  const categoria = historyCategoriaSignal.value;
  const { data: faturas = [] } = useFaturas();
  const query = useTransactions({ categoria: categoria || undefined, limit: 200 });
  const rows = query.data || [];
  const [editingId, setEditingId] = useState(null);

  return (
    <section id="view-history" class="deck-page">
      <div class="history-filter">
        <label for="history-cat">Categoria</label>
        <select
          id="history-cat"
          value={categoria}
          onChange={(e) => { historyCategoriaSignal.value = e.currentTarget.value || ''; }}
        >
          <option value="">todas</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div id="history-list" class="history-list">
        {query.isLoading && !rows.length && <div class="empty">Carregando...</div>}
        {query.isError && <div class="empty">Erro: {String(query.error?.message || query.error)}</div>}
        {!query.isLoading && !rows.length && !query.isError && <div class="empty">Nenhum lançamento ainda.</div>}
        {rows.map(r => (
          editingId === r.id
            ? <EditingRow key={r.id} row={r} faturas={faturas} onClose={() => setEditingId(null)} />
            : <DisplayRow key={r.id} row={r} faturas={faturas} onLongPress={() => setEditingId(r.id)} />
        ))}
      </div>
    </section>
  );
}
