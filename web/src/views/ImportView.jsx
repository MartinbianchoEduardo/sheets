import { useEffect, useRef, useState } from 'preact/hooks';
import { CATEGORIES } from '../lib/categories.js';
import { formatBRL, formatDate } from '../lib/format.js';
import { subpageSignal, setTab } from '../lib/state.js';
import { useImportPreview, useImportConfirm } from '../hooks/useImport.js';
import { useToast } from '../components/Toast.jsx';

// iOS-style swipe-left to dismiss; vertical motion hands off to native scroll.
function useSwipeToDismiss(ref, onDismiss) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let startX = 0, startY = 0, currentX = 0;
    let direction = null;
    let active = false;
    const DISMISS = 0.4, DIR_LOCK = 8;

    function onStart(e) {
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX; startY = t.clientY;
      currentX = 0; direction = null; active = true;
      el.classList.add('swiping');
    }
    function onMove(e) {
      if (!active) return;
      const t = e.touches ? e.touches[0] : e;
      const dx = t.clientX - startX, dy = t.clientY - startY;
      if (direction === null) {
        if (Math.abs(dx) < DIR_LOCK && Math.abs(dy) < DIR_LOCK) return;
        direction = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';
        if (direction === 'vertical') { el.classList.remove('swiping'); return; }
      }
      if (direction !== 'horizontal') return;
      const w = el.offsetWidth || 1;
      const clamped = Math.min(0, Math.max(-w, dx));
      currentX = clamped;
      el.style.transform = `translateX(${clamped}px)`;
      el.style.opacity = String(1 - Math.min(1, Math.abs(clamped) / w) * 0.5);
    }
    function onEnd() {
      if (!active) return;
      active = false;
      el.classList.remove('swiping');
      if (direction === 'horizontal' && Math.abs(currentX) > el.offsetWidth * DISMISS) {
        const h = el.getBoundingClientRect().height;
        el.style.maxHeight = h + 'px';
        el.offsetHeight; // force layout
        el.style.transform = `translateX(-${el.offsetWidth}px)`;
        el.style.opacity = '0';
        setTimeout(() => {
          el.style.maxHeight = '0px';
          el.style.paddingTop = '0';
          el.style.paddingBottom = '0';
          el.style.borderTopWidth = '0';
        }, 130);
        setTimeout(onDismiss, 360);
      } else {
        el.style.transform = '';
        el.style.opacity = '';
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [onDismiss]);
}

function PreviewRow({ row, onChangeCategoria, onDismiss }) {
  const ref = useRef(null);
  useSwipeToDismiss(ref, onDismiss);
  if (row.invalid) {
    return (
      <div class="preview-row" ref={ref}>
        <div class="desc">{row.descricao || '(sem descrição)'}</div>
        <div class="val">{row.raw_amount || ''}</div>
        <div class="meta"><span class="outro-flag">inválido: {row.reason}</span></div>
      </div>
    );
  }
  const outro = row.categoria === 'Outro';
  return (
    <div class={'preview-row' + (outro ? ' outro' : '')} ref={ref}>
      <div class="desc">{row.descricao}</div>
      <div class="val">{formatBRL(row.valor_cents)}</div>
      <div class="meta">
        <span>{formatDate(row.data)}</span>
        <select class="cat-sel" value={row.categoria} onChange={(e) => onChangeCategoria(e.currentTarget.value)}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span>{row.fatura_nome || '—'}</span>
        {outro && <span class="outro-flag">Sem regra</span>}
      </div>
    </div>
  );
}

export function ImportView() {
  const toast = useToast();
  const preview = useImportPreview();
  const confirm = useImportConfirm();
  const [csv, setCsv] = useState('');
  const [rows, setRows] = useState([]);
  const fileRef = useRef(null);

  async function onFile(e) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setCsv(await file.text());
  }

  async function onPreview() {
    if (!csv.trim()) return toast('Cole o CSV antes', 'err');
    try {
      const res = await preview.mutateAsync({ csv });
      setRows((res.rows || []).map(r => ({ ...r, original_categoria: r.categoria })));
    } catch (err) {
      if (err.message === 'csv_parse_failed') toast('CSV inválido — confira o cabeçalho date,title,amount', 'err');
      else if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
    }
  }

  function onCancel() {
    const had = rows.length || csv.trim() || (fileRef.current?.files?.length);
    if (!had) return;
    setRows([]);
    setCsv('');
    if (fileRef.current) fileRef.current.value = '';
    toast('Importação cancelada', 'ok');
  }

  async function onConfirm() {
    const payload = rows
      .filter(r => !r.invalid)
      .map(r => ({
        data: r.data,
        descricao: r.descricao,
        valor_cents: r.valor_cents,
        categoria: r.categoria,
        manually_categorized: r.categoria !== r.original_categoria,
      }));
    if (!payload.length) return toast('Nada para importar', 'err');
    try {
      const res = await confirm.mutateAsync(payload);
      toast(`${res.inserted_count} lançamento(s) adicionado(s) ✓`, 'ok');
      setRows([]);
      setCsv('');
      if (fileRef.current) fileRef.current.value = '';
      subpageSignal.value = null;
      setTab('history');
    } catch (err) {
      if (err.message !== 'session_expired') toast('Erro: ' + err.message, 'err');
    }
  }

  const valid = rows.filter(r => !r.invalid);
  const invalid = rows.filter(r => r.invalid);
  const outroCount = valid.filter(r => r.categoria === 'Outro').length;
  const canConfirm = valid.length > 0 && !confirm.isPending;

  return (
    <div>
      <div class="import-section">
        <h3>Colar CSV (Nubank: date,title,amount)</h3>
        <textarea
          id="import-csv"
          class="import-textarea"
          placeholder={'date,title,amount\n2026-05-04,IFOOD *RESTAURANT,42.90'}
          value={csv}
          onInput={(e) => setCsv(e.currentTarget.value)}
        />
        <label class="import-file">
          ou enviar arquivo:
          <input type="file" id="import-file" accept=".csv,text/csv" ref={fileRef} onChange={onFile} />
        </label>
        <div class="import-btn-row">
          <button class="import-btn" type="button" disabled={preview.isPending} onClick={onPreview}>
            {preview.isPending ? 'Processando...' : 'Pré-visualizar'}
          </button>
          <button class="import-btn primary" type="button" disabled={!canConfirm} onClick={onConfirm}>
            {confirm.isPending ? 'Enviando...' : 'Confirmar'}
          </button>
          <button class="import-btn" type="button" disabled={!canConfirm} onClick={onCancel}>Cancelar</button>
        </div>
      </div>

      {rows.length > 0 && (
        <div class="import-section">
          <div class="preview-summary">
            <span>{valid.length} lançamento{valid.length === 1 ? '' : 's'}</span>
            <span>{outroCount} sem regra</span>
          </div>
          {rows.map((r, i) => (
            <PreviewRow
              key={`${i}-${r.data}-${r.descricao}`}
              row={r}
              onChangeCategoria={(v) => setRows(rs => rs.map((x, j) => j === i ? { ...x, categoria: v } : x))}
              onDismiss={() => setRows(rs => rs.filter((_, j) => j !== i))}
            />
          ))}
          {invalid.length > 0 && (
            <div class="preview-invalid">{invalid.length} linha(s) inválida(s) — ignoradas no envio</div>
          )}
        </div>
      )}
    </div>
  );
}
