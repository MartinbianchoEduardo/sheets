import { useEffect, useRef, useState } from 'preact/hooks';
import { CATEGORIES } from '../lib/categories.js';
import { parseValor, wireValorMask } from '../lib/format.js';
import {
  useRecurring, useCreateRecurring, useUpdateRecurring, useDeleteRecurring,
} from '../hooks/useRecurring.js';
import { CategoryDot } from './CategoryDot.jsx';
import { useToast } from './Toast.jsx';

function RecurringEditingRow({ row, onClose }) {
  const toast = useToast();
  const update = useUpdateRecurring();
  const del = useDeleteRecurring();
  const valorRef = useRef(null);

  const [descricao, setDescricao] = useState(row.descricao);
  const [valor, setValor] = useState((row.valor_cents / 100).toFixed(2).replace('.', ','));
  const [categoria, setCategoria] = useState(row.categoria);
  const [dia, setDia] = useState(String(row.dia_do_mes));
  const [active, setActive] = useState(!!row.active);

  useEffect(() => { wireValorMask(valorRef.current); }, []);

  async function onSave() {
    const d = descricao.trim();
    if (!d) return toast('Informe a descrição', 'err');
    const v = parseValor(valor);
    if (isNaN(v) || v < 0) return toast('Valor inválido', 'err');
    const diaN = Number(dia);
    if (!Number.isInteger(diaN) || diaN < 1 || diaN > 31) return toast('Dia entre 1 e 31', 'err');
    try {
      await update.mutateAsync({
        id: row.id,
        descricao: d,
        valor_cents: Math.round(v * 100),
        categoria,
        dia_do_mes: diaN,
        active,
      });
      onClose();
      toast('Recorrente atualizado ✓', 'ok');
    } catch (err) {
      if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
    }
  }

  async function onDelete() {
    if (!window.confirm('Excluir este recorrente?')) return;
    try {
      await del.mutateAsync(row.id);
      onClose();
      toast('Recorrente excluído', 'ok');
    } catch (err) {
      if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
    }
  }

  return (
    <div class="recurring-edit-row editing" data-id={row.id}>
      <div class="field full">
        <label>Descrição</label>
        <input
          type="text"
          maxLength={200}
          value={descricao}
          onInput={(e) => setDescricao(e.currentTarget.value)}
        />
      </div>
      <div class="recurring-edit-grid">
        <div class="field">
          <label>Valor</label>
          <input
            type="text"
            inputmode="decimal"
            ref={valorRef}
            value={valor}
            onInput={(e) => setValor(e.currentTarget.value)}
          />
        </div>
        <div class="field">
          <label>Dia do mês</label>
          <input
            type="number"
            inputmode="numeric"
            min="1"
            max="31"
            value={dia}
            onInput={(e) => setDia(e.currentTarget.value)}
          />
        </div>
      </div>
      <div class="field">
        <label>Categoria</label>
        <select value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <label class="recurring-active">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.currentTarget.checked)} />
        <span>ativo</span>
      </label>
      <div class="config-btn-row" style={{ justifyContent: 'flex-start' }}>
        <button class="config-btn" type="button" onClick={onSave}>salvar</button>
        <button class="config-btn danger" type="button" onClick={onDelete}>excluir</button>
        <button class="config-btn muted" type="button" onClick={onClose}>cancelar</button>
      </div>
    </div>
  );
}

function RecurringNewRow({ onClose }) {
  const toast = useToast();
  const create = useCreateRecurring();
  const valorRef = useRef(null);

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIES[0]);
  const [dia, setDia] = useState('1');
  const [active, setActive] = useState(true);

  useEffect(() => { wireValorMask(valorRef.current); }, []);

  async function onAdd() {
    const d = descricao.trim();
    if (!d) return toast('Informe a descrição', 'err');
    const v = parseValor(valor);
    if (isNaN(v) || v < 0) return toast('Valor inválido', 'err');
    const diaN = Number(dia);
    if (!Number.isInteger(diaN) || diaN < 1 || diaN > 31) return toast('Dia entre 1 e 31', 'err');
    try {
      await create.mutateAsync({
        descricao: d,
        valor_cents: Math.round(v * 100),
        categoria,
        dia_do_mes: diaN,
        active,
      });
      onClose();
      toast('Recorrente adicionado ✓', 'ok');
    } catch (err) {
      if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
    }
  }

  return (
    <div class="recurring-edit-row editing" data-id="new">
      <div class="field full">
        <label>Descrição</label>
        <input
          type="text"
          maxLength={200}
          placeholder="Ex: Netflix"
          autoFocus
          value={descricao}
          onInput={(e) => setDescricao(e.currentTarget.value)}
        />
      </div>
      <div class="recurring-edit-grid">
        <div class="field">
          <label>Valor</label>
          <input
            type="text"
            inputmode="decimal"
            placeholder="0,00"
            ref={valorRef}
            value={valor}
            onInput={(e) => setValor(e.currentTarget.value)}
          />
        </div>
        <div class="field">
          <label>Dia do mês</label>
          <input
            type="number"
            inputmode="numeric"
            min="1"
            max="31"
            value={dia}
            onInput={(e) => setDia(e.currentTarget.value)}
          />
        </div>
      </div>
      <div class="field">
        <label>Categoria</label>
        <select value={categoria} onChange={(e) => setCategoria(e.currentTarget.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <label class="recurring-active">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.currentTarget.checked)} />
        <span>ativo</span>
      </label>
      <div class="config-btn-row" style={{ justifyContent: 'flex-start' }}>
        <button class="config-btn" type="button" onClick={onAdd}>adicionar</button>
        <button class="config-btn muted" type="button" onClick={onClose}>cancelar</button>
      </div>
    </div>
  );
}

function RecurringDisplayRow({ row, onEdit }) {
  return (
    <div class={'recurring-display-row' + (row.active ? '' : ' inactive')} data-id={row.id}>
      <div class="rd-line1">
        <span class="rd-cat">
          <CategoryDot category={row.categoria} />
          <span>{row.categoria}</span>
        </span>
        <span class="rd-desc">{row.descricao}</span>
      </div>
      <div class="rd-line2">
        <span>dia {row.dia_do_mes}</span>
        <span>·</span>
        <span class="rd-val">{(row.valor_cents / 100).toFixed(2).replace('.', ',')}</span>
        {!row.active && <><span>·</span><span class="rd-inactive">inativo</span></>}
      </div>
      <div class="rd-actions">
        <button class="config-btn" type="button" onClick={onEdit}>editar</button>
      </div>
    </div>
  );
}

export function RecurringSubpage() {
  const { data: rows = [], isLoading, isError, error } = useRecurring();
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  return (
    <div>
      {isLoading && !rows.length && <div class="empty">Carregando...</div>}
      {isError && <div class="empty">Erro: {String(error?.message || error)}</div>}
      {!isLoading && !isError && (
        rows.length
          ? (
            <div class="recurring-config-list">
              {rows.map(r => (
                editingId === r.id
                  ? <RecurringEditingRow key={r.id} row={r} onClose={() => setEditingId(null)} />
                  : <RecurringDisplayRow key={r.id} row={r} onEdit={() => setEditingId(r.id)} />
              ))}
            </div>
          )
          : <div class="empty">Nenhum recorrente ainda.</div>
      )}
      {adding
        ? <RecurringNewRow onClose={() => setAdding(false)} />
        : <button class="add-regra-btn" type="button" onClick={() => setAdding(true)}>+ novo recorrente</button>}
    </div>
  );
}
