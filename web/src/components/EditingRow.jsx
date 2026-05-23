import { useEffect, useRef, useState } from 'preact/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { CATEGORIES, REFUND_CATEGORY } from '../lib/categories.js';
import { parseValor, wireValorMask, resolveFaturaForDateClient, guessChaveFromDescricao } from '../lib/format.js';
import { api } from '../lib/api.js';
import {
  useUpdateTransaction, useDeleteTransaction, useRestoreTransaction,
} from '../hooks/useTransactions.js';
import { useCreateRule } from '../hooks/useRules.js';
import { useToast } from './Toast.jsx';

// After categorizing an Outro row to something else, offer to remember the
// merchant. Skipped silently if the guessed chave is already covered.
export async function maybePromptAddRule({ qc, createRule, toast, descricao, categoria }) {
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

export function EditingRow({ row, faturas, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const update = useUpdateTransaction();
  const del = useDeleteTransaction();
  const restore = useRestoreTransaction();
  const createRule = useCreateRule();
  const valorRef = useRef(null);

  const initialCents = row.categoria === REFUND_CATEGORY ? Math.abs(row.valor_cents) : row.valor_cents;
  const [descricao, setDescricao] = useState(row.descricao);
  const [valor, setValor] = useState((initialCents / 100).toFixed(2).replace('.', ','));
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
    const valor_cents = categoria === REFUND_CATEGORY
      ? -Math.round(Math.abs(v) * 100)
      : Math.round(v * 100);
    const prevCategoria = row.categoria;
    try {
      await update.mutateAsync({
        id: row.id,
        descricao: descricao.trim(),
        valor_cents,
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
