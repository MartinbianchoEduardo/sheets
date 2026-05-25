import { useEffect, useRef, useState } from 'preact/hooks';
import { CATEGORIES, REFUND_CATEGORY } from '../lib/categories.js';
import { isoToday, parseValor, wireValorMask, resolveFaturaForDateClient } from '../lib/format.js';
import { matchRule } from '../lib/rules.js';
import { useFaturas } from '../hooks/useFaturas.js';
import { useRules } from '../hooks/useRules.js';
import { useCreateTransaction } from '../hooks/useTransactions.js';
import { useToast } from '../components/Toast.jsx';

export function AddView() {
  const toast = useToast();
  const { data: faturas = [] } = useFaturas();
  const { data: rules = [] } = useRules();
  const create = useCreateTransaction();

  const [data, setData] = useState(isoToday());
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('');
  const [manuallyChosen, setManuallyChosen] = useState(false);
  const valorRef = useRef(null);

  useEffect(() => { wireValorMask(valorRef.current); }, []);

  useEffect(() => {
    if (manuallyChosen) return;
    const t = setTimeout(() => {
      const suggested = matchRule(descricao, rules) || '';
      setCategoria(prev => (prev === suggested ? prev : suggested));
    }, 150);
    return () => clearTimeout(t);
  }, [descricao, rules, manuallyChosen]);

  const faturaForDate = resolveFaturaForDateClient(data, faturas);
  const faturaNome = faturaForDate ? faturaForDate.nome : '—';

  async function onSubmit() {
    if (!data)      return toast('Informe a data', 'err');
    if (!descricao.trim()) return toast('Informe a descrição', 'err');
    if (!valor.trim())     return toast('Informe o valor', 'err');
    if (!categoria) return toast('Escolha uma categoria', 'err');

    const v = parseValor(valor);
    if (isNaN(v)) return toast('Valor inválido', 'err');
    const valor_cents = categoria === REFUND_CATEGORY
      ? -Math.round(Math.abs(v) * 100)
      : Math.round(v * 100);

    try {
      await create.mutateAsync({
        data, descricao: descricao.trim(), valor_cents, categoria,
      });
      toast('Lançamento adicionado ✓', 'ok');
      setDescricao('');
      setValor('');
      setCategoria('');
      setManuallyChosen(false);
    } catch (err) {
      if (err.message !== 'session_expired') {
        toast('Erro: ' + err.message, 'err');
      }
    }
  }

  return (
    <section id="view-add" class="deck-page">
      <div class="field">
        <label>Data</label>
        <input type="date" id="f-data" value={data} onInput={(e) => setData(e.currentTarget.value)} />
      </div>

      <div class="field">
        <label>Descrição</label>
        <input
          type="text"
          id="f-descricao"
          placeholder="Ex: Sushi em casa"
          maxLength={200}
          value={descricao}
          onInput={(e) => setDescricao(e.currentTarget.value)}
        />
      </div>

      <div class="field">
        <label>Valor</label>
        <div class="valor-wrap">
          <input
            type="text"
            id="f-valor"
            inputmode="decimal"
            placeholder="0,00"
            ref={valorRef}
            value={valor}
            onInput={(e) => setValor(e.currentTarget.value)}
          />
        </div>
      </div>

      <div class="field">
        <label>Categoria</label>
        <div class="chips" id="f-categoria">
          {CATEGORIES.map(c => {
            const isSelected = categoria === c;
            const isAuto = isSelected && !manuallyChosen;
            return (
              <button
                key={c}
                type="button"
                class={'chip' + (isSelected ? ' selected' : '') + (isAuto ? ' auto' : '')}
                onClick={() => { setManuallyChosen(true); setCategoria(c); }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div class="field">
        <label>Fatura</label>
        <input type="text" id="f-fatura" readOnly placeholder="—" value={faturaNome} />
      </div>

      <button class="btn-primary" id="submit-btn" disabled={create.isPending} onClick={onSubmit}>
        {create.isPending ? <span class="spinner" /> : 'Adicionar lançamento'}
      </button>
    </section>
  );
}
