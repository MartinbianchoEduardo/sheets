// Painel (Control tab) payload. Derived numbers only — no persistence here.
//
// Math is the spec §4 / plan §4 calculations. Reuses getSummary so the
// "Fatura atual" definition stays in sync with Resumo.

import { queryOne } from './db.js';
import { getSummary } from './summary.js';
import { getFatura, currentFatura } from './faturas.js';
import { getSettings } from './settings.js';

function todayIsoSaoPaulo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addDaysIso(iso, delta) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function daysBetweenIso(a, b) {
  const da = new Date(a + 'T00:00:00Z');
  const db = new Date(b + 'T00:00:00Z');
  return Math.round((db - da) / 86400000);
}

// Closing date for a fatura = day before the next fatura's start_date. If no
// next fatura exists yet, fall back to `fechamento_dia` interpreted as a
// day-of-month in the month after start_date (best-effort; user should add the
// next cycle for accurate "dias restantes").
async function closingDateFor(env, fatura, fechamentoDia) {
  const next = await queryOne(
    env,
    'SELECT start_date FROM faturas WHERE start_date > ? ORDER BY start_date ASC LIMIT 1',
    fatura.start_date,
  );
  if (next) return addDaysIso(next.start_date, -1);
  const start = new Date(fatura.start_date + 'T00:00:00Z');
  const candidate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, fechamentoDia));
  return candidate.toISOString().slice(0, 10);
}

async function resolveFatura(env, faturaId) {
  if (faturaId != null) return getFatura(env, faturaId);
  const cur = await currentFatura(env);
  return cur.fatura;
}

export async function getDashboard(env, faturaId) {
  const [fatura, settings] = await Promise.all([
    resolveFatura(env, faturaId),
    getSettings(env),
  ]);

  if (!fatura) {
    return {
      fatura: null,
      salario_cents: 0,
      gasto_fixo_cents: 0,
      investimento_alvo_cents: 0,
      limite_fatura_cents: 0,
      fatura_atual_cents: 0,
      emprestado_pendente_cents: 0,
      disponivel_mes_cents: 0,
      disponivel_diario_cents: 0,
      fechamento_dia: settings.fechamento_dia,
      closing_date: null,
      days_remaining: 0,
      reserva_atual_cents: settings.reserva_atual_cents,
      reserva_meta_cents: 0,
      reserva_pct: 0,
    };
  }

  const [summary, recorrenteRow] = await Promise.all([
    getSummary(env, fatura.id),
    queryOne(env,
      `SELECT COALESCE(SUM(valor_cents), 0) AS s FROM transactions
       WHERE fatura_id = ? AND deleted_at IS NULL AND categoria = 'Recorrente'`,
      fatura.id),
  ]);

  const salario_cents = fatura.salario_cents || 0;
  const gasto_fixo_cents = recorrenteRow.s || 0;
  const investimento_alvo_cents = Math.round(salario_cents * settings.meta_investimento_pct);
  const limite_fatura_cents = salario_cents - gasto_fixo_cents - investimento_alvo_cents;

  const fatura_atual_cents = summary.totals.fatura_cents;
  const emprestado_pendente_cents = summary.totals.emprestado_cents;

  const disponivel_mes_cents =
    (salario_cents - gasto_fixo_cents - investimento_alvo_cents + emprestado_pendente_cents)
    - fatura_atual_cents;

  const fechamento_dia = settings.fechamento_dia;
  const closing_date = await closingDateFor(env, fatura, fechamento_dia);
  const today = todayIsoSaoPaulo();
  // days_remaining is inclusive of today; 0 once today > closing_date (cycle
  // closed) or today < start_date (fatura is in the future).
  let days_remaining = 0;
  if (today >= fatura.start_date && today <= closing_date) {
    days_remaining = daysBetweenIso(today, closing_date) + 1;
  }
  const disponivel_diario_cents = days_remaining > 0
    ? Math.round((limite_fatura_cents - fatura_atual_cents) / days_remaining)
    : 0;

  const reserva_atual_cents = settings.reserva_atual_cents;
  const reserva_meta_cents = Math.round(gasto_fixo_cents * settings.reserva_meta_multiplier);
  const reserva_pct = Math.min(1, reserva_atual_cents / Math.max(1, reserva_meta_cents));

  return {
    fatura: { id: fatura.id, nome: fatura.nome, start_date: fatura.start_date, salario_cents },
    salario_cents,
    gasto_fixo_cents,
    investimento_alvo_cents,
    limite_fatura_cents,
    fatura_atual_cents,
    emprestado_pendente_cents,
    disponivel_mes_cents,
    disponivel_diario_cents,
    fechamento_dia,
    closing_date,
    days_remaining,
    reserva_atual_cents,
    reserva_meta_cents,
    reserva_pct,
  };
}

export async function forecastReserve(env, input) {
  const settings = await getSettings(env);

  const months = Number.isInteger(input && input.months) && input.months > 0 && input.months <= 240
    ? input.months
    : 24;

  let taxa = input && typeof input.taxa_mensal_pct === 'number'
    ? input.taxa_mensal_pct
    : settings.taxa_juros_mensal_pct;
  if (!isFinite(taxa)) taxa = 0;

  let contribuicao;
  if (input && Number.isInteger(input.contribuicao_cents)) {
    contribuicao = input.contribuicao_cents;
  } else {
    const cur = await currentFatura(env);
    const salario = cur.fatura ? (cur.fatura.salario_cents || 0) : 0;
    contribuicao = Math.round(salario * settings.meta_investimento_pct);
  }

  const projection = [];
  let balance = settings.reserva_atual_cents;
  for (let m = 1; m <= months; m++) {
    balance = Math.round((balance + contribuicao) * (1 + taxa));
    projection.push({ month: m, deposit_cents: contribuicao, balance_cents: balance });
  }
  return {
    projection,
    starting_balance_cents: settings.reserva_atual_cents,
    contribuicao_cents: contribuicao,
    taxa_mensal_pct: taxa,
  };
}
