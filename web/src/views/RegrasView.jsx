import { useState } from 'preact/hooks';
import { CATEGORIES } from '../lib/categories.js';
import {
  useRules, useCreateRule, useUpdateRule, useDeleteRule, useReorderRules,
} from '../hooks/useRules.js';
import { useToast } from '../components/Toast.jsx';

function RegraRow({ rule, idx, total, onReorder }) {
  const toast = useToast();
  const update = useUpdateRule();
  const del = useDeleteRule();
  const [chave, setChave] = useState(rule.chave);

  async function commitChave() {
    const v = chave.trim();
    if (v === rule.chave) return;
    if (!v) {
      setChave(rule.chave);
      toast('Chave não pode ser vazia', 'err');
      return;
    }
    try {
      await update.mutateAsync({ id: rule.id, chave: v });
    } catch (err) {
      if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
      setChave(rule.chave);
    }
  }

  async function commitCategoria(e) {
    const v = e.currentTarget.value;
    if (v === rule.categoria) return;
    try {
      await update.mutateAsync({ id: rule.id, categoria: v });
    } catch (err) {
      if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
    }
  }

  async function onDelete() {
    try {
      await del.mutateAsync(rule.id);
      toast('Regra excluída', 'ok');
    } catch (err) {
      if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
    }
  }

  return (
    <div class="regra-row" data-id={rule.id}>
      <input
        class="chave"
        maxLength={80}
        value={chave}
        onInput={(e) => setChave(e.currentTarget.value)}
        onBlur={commitChave}
      />
      <select class="cat" value={rule.categoria} onChange={commitCategoria}>
        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <div class="arrows">
        <button class="arrow-btn" type="button" disabled={idx === 0} onClick={() => onReorder(idx, -1)}>▲</button>
        <button class="arrow-btn" type="button" disabled={idx === total - 1} onClick={() => onReorder(idx, +1)}>▼</button>
      </div>
      <div class="regra-actions">
        <button class="regra-action danger" type="button" onClick={onDelete}>excluir</button>
      </div>
    </div>
  );
}

function AddRegraForm({ onClose }) {
  const toast = useToast();
  const create = useCreateRule();
  const [chave, setChave] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIES[0]);

  async function onAdd() {
    const v = chave.trim();
    if (!v) return toast('Informe a chave', 'err');
    try {
      await create.mutateAsync({ chave: v, categoria });
      onClose();
      toast('Regra adicionada ✓', 'ok');
    } catch (err) {
      if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
    }
  }

  return (
    <div class="regras-list">
      <div class="regra-row" data-id="new">
        <input
          class="chave"
          id="new-regra-chave"
          maxLength={80}
          placeholder="ex: ifood"
          autoFocus
          value={chave}
          onInput={(e) => setChave(e.currentTarget.value)}
        />
        <select class="cat" id="new-regra-cat" value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div class="arrows" />
        <div class="regra-actions">
          <button class="regra-action" type="button" onClick={onAdd}>adicionar</button>
          <button class="regra-action muted" type="button" onClick={onClose}>cancelar</button>
        </div>
      </div>
    </div>
  );
}

export function RegrasView() {
  const toast = useToast();
  const { data: rules = [], isLoading, isError, error } = useRules();
  const reorder = useReorderRules();
  const [adding, setAdding] = useState(false);

  async function onReorder(idx, dir) {
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= rules.length) return;
    const next = rules.slice();
    [next[idx], next[swap]] = [next[swap], next[idx]];
    try {
      await reorder.mutateAsync(next.map(r => r.id));
    } catch (err) {
      if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
    }
  }

  return (
    <div>
      {isLoading && !rules.length && <div class="empty">Carregando...</div>}
      {isError && <div class="empty">Erro: {String(error?.message || error)}</div>}
      {!isLoading && !isError && (
        rules.length
          ? (
            <div class="regras-list">
              {rules.map((r, i) => (
                <RegraRow key={r.id} rule={r} idx={i} total={rules.length} onReorder={onReorder} />
              ))}
            </div>
          )
          : <div class="empty">Nenhuma regra ainda.</div>
      )}
      {adding
        ? <AddRegraForm onClose={() => setAdding(false)} />
        : <button class="add-regra-btn" type="button" onClick={() => setAdding(true)}>+ nova regra</button>}
    </div>
  );
}
