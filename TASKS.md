# Tasks — Charts & "see the future" features

Planned 2026-06-01. Five tasks across chart readability + two product features.

## Implementation order

1. **T1 — Sparkline foundation** (refactor, unblocks T2 + T3)
2. **T3 — Drill-down chart, all-in details**
3. **T2 — Medium-chart annotation pass**
4. **T5 — Reserve-goal ETA text**
5. **T4 — History faixa-de-valor filter**

T2, T3, T5, T4 are independent of each other once T1 is done.

## Project context (applies to every task)

Gastos is a single-user mobile-first expense-logger PWA. Preact + Vite frontend in `web/`, Cloudflare Worker in `gastos-auth/`, D1 SQLite. UI strings in pt-BR, currency BRL. Read `CLAUDE.md` at the project root for the full conventions before touching any code — every prompt below assumes you've done that.

Key conventions in short:
- Plain JS + JSX, no TypeScript. State in `@preact/signals`. Data fetching in TanStack Query, one hook per Worker endpoint under `web/src/hooks/`.
- Comments only when the *why* is non-obvious. No what-comments. Delete unnecessary comments you encounter.
- No tests, no CI — verify by running `npm run deploy:pages` locally to confirm the build, then by eye on the deployed app.
- Don't add dependencies. Pure SVG for all charts.
- Don't change the Worker unless explicitly required.
- Mobile-first; tap targets ≥ 40px (use invisible padding hit boxes around small dots).

you have permission to deploy with npm run deploy:worker or npm run deploy:pages or npm run deploy after implementing each task and reviewing if everything is good. Also paste a direct, brief commit message to be used in the commit for the implementation.
Also give the user a small paragraph on how and where to see and test the changes briefly.

---

## T1 — Sparkline foundation

**Status**: not started · **Depends on**: nothing · **Unblocks**: T2, T3

### Prompt

```
You're working on Gastos, a single-user mobile-first expense-logger PWA (Preact + Vite frontend in web/, Cloudflare Worker in gastos-auth/, D1 SQLite). Read CLAUDE.md at the project root first for the full conventions before touching code.

Three places in the codebase hand-roll the same SVG sparkline math + markup:
1. web/src/views/TendenciasView.jsx — HeroChart (large) and CategoryCell (small grid sparkline). The buildPolyline helper lives at the top of this file.
2. web/src/views/PainelView.jsx — ReserveSparkline (medium).

Extract this into a single reusable component so later tasks can build on it instead of forking it further.

WHAT TO BUILD

1. web/src/lib/spark.js (new) — pure function:
     export function buildPolyline(values, w, h) { ... }
   Move the exact implementation that lives at the top of TendenciasView.jsx today. Returns { polyline, area, min, max }.

2. web/src/components/Sparkline.jsx (new) — JSX component.
   Props:
     - values: number[]
     - width: number, height: number  (the SVG viewBox)
     - color?: string  (CSS color or var; falls back to var(--accent))
     - markers?: Marker[]
     - xLabels?: string[]  (compact labels rendered below the SVG)
     - className?: string, style?: object
   Marker = { index: number, kind: 'min' | 'max' | 'avg' | 'current' | 'milestone', label?: string }
     - min / max / current → dot at (x, y) of that index, with a small floating value label
     - avg → horizontal dashed line at avg y-position; small label at right edge
     - milestone → vertical dashed line at the marker's x; label above the line
   When markers is empty/undefined, render just area + polyline (the bare small-tier case).
   Use viewBox="0 0 {w} {h}" and preserveAspectRatio="none".

3. web/src/styles/spark.css (new) — styles for markers (dots, dashed lines, value labels). Import it from web/src/styles/_imports.css. Value labels: 'JetBrains Mono', monospace, tabular-nums.

4. Rewrite the three callers to use <Sparkline /> with NO markers (T2 will add them):
   - TendenciasView.jsx#HeroChart — pass values, large size, no markers.
   - TendenciasView.jsx#CategoryCell — bare small sparkline, no markers. Preserve the per-category --c CSS variable via style.
   - PainelView.jsx#ReserveSparkline — pass values, medium size, no markers.
   Delete the now-unused inline SVG markup and the local buildPolyline in TendenciasView.

CONSTRAINTS
- Pure SVG, no chart library. No new dependencies.
- The existing CSS classes (.trend-hero, .trend-spark, .reserve-spark) carry the visual styling. Keep them by letting callers pass className. Don't migrate styling into Sparkline.jsx itself.
- This task is a pure refactor. Visual output should be pixel-identical. Compare Tendências (hero + grid) and Painel (reserve card) before/after by eye.

DONE WHEN
- Three callers use <Sparkline />.
- buildPolyline lives only in web/src/lib/spark.js.
- No visual regression on Tendências or Painel.
- npm run deploy:pages builds without errors.
```

---

## T3 — Drill-down chart, all-in details

**Status**: not started · **Depends on**: T1

### Prompt

```
You're working on Gastos, a single-user mobile-first expense-logger PWA. Read CLAUDE.md at the project root for the full conventions before touching code.

The Tendências tab has a per-category grid (web/src/views/TendenciasView.jsx). Tapping a category cell opens web/src/components/CategoryTrendDrillSubpage.jsx, which today shows: header, summary strip (total + count), and a transaction list grouped by fatura. No chart.

Add a full analysis layout at the top of the drill, replacing the current .drill-summary strip.

PREREQ
T1 (Sparkline foundation) must be done. You will use <Sparkline /> from web/src/components/Sparkline.jsx and buildPolyline from web/src/lib/spark.js.

WHAT TO BUILD

1) Top card — Tendência da categoria (replaces .drill-summary)
   - Title row: [CategoryDot] {categoria} on the left, last-fatura value on the right.
   - Subtitle: "Últimas N faturas · toque um ponto".
   - Large <Sparkline /> (viewBox 300×80, ~120px tall in CSS) using CATEGORY_COLORS[categoria], with markers:
     - one 'current'-style dot per fatura (tappable — see interactivity)
     - 'min' and 'max' markers with R$ labels
     - 'avg' dashed reference line with right-edge label "média R$X"
     - 'current' marker on the latest fatura in accent or category color, slightly larger
   - xLabels: abbreviated month from f.nome or f.start_date — three chars max ("Mai", "Jun", "Jul").
   - Stats strip below the chart: "média R$… · mín R$… (Fatura N) · máx R$… (Fatura M)" + a bigger Delta-vs-média badge.
     - Reuse the Delta visual treatment that lives in TendenciasView.jsx. Extract Delta to its own component file (e.g. web/src/components/TrendDelta.jsx) and import from both sites.

2) Interactivity — chart ↔ list link
   - Local state activeFaturaId inside the drill component.
   - Tap a chart dot → set activeFaturaId, scroll the matching .trend-drill-group into view with scrollIntoView({ behavior: 'smooth', block: 'start' }), add an .active class to that group's header.
   - Each .trend-drill-group gets id={`fatura-${g.fatura.id}`} and a clickable header that sets activeFaturaId (reverse direction: list → chart highlight, no scroll).
   - The active dot in the chart should be visually larger / outlined. Either toggle a class on the SVG root that targets a specific dot index, or render a separate "active" marker overlay — pick whichever stays clean.

3) Current-cycle forecast for this categoria
   - Call useDashboard(currentFaturaIdSignal.value) from the drill (currentFaturaIdSignal is in web/src/lib/state.js).
   - If the most recent fatura in trendsQ.data.faturas equals dashboard.fatura.id AND dashboard.days_elapsed > 0 AND dashboard.cycle_total_days > 0 AND dashboard.days_elapsed < dashboard.cycle_total_days:
     - projection_cents = Math.round(current_cents * cycle_total_days / days_elapsed) where current_cents is the latest fatura's category total.
     - Render a faint dashed segment from the current dot extending to the right edge ending in a hollow projection dot, labeled "projeção R$X".
   - If conditions aren't met, omit the projection silently.

4) Per-category budget burn bar
   - Use useBudgets() (web/src/hooks/useBudgets.js).
   - If a budget exists for categoria for the current fatura:
     - Below the stats strip, render a small horizontal bar:
       - Fill width = current_cents / budget_cents (clamped 0–1; current_cents = latest fatura's category total).
       - A second vertical tick at cycle_elapsed_pct (from useDashboard) showing where the cycle currently is.
     - Subtitle: "X% gasto · Y% do ciclo". If usage > 1.0, color the fill in var(--danger).
   - Hide the bar if no budget set.

5) Top 5 descrições
   - Aggregate the already-loaded rows (across all 12 faturas) by descricao.trim().toLowerCase() → sum of valor_cents. Take top 5 by absolute sum.
   - Render as horizontal mini-bars: descricao on left, R$ on right, bar fill = value / topValue.
   - Small card titled "Top descrições", subtitle "Maiores gastos nesta categoria".

6) Dia-da-semana strip
   - Compute average gasto per dia-da-semana (0..6, Sunday..Saturday) for this category from rows. Skip days with zero transactions (don't divide by zero).
   - Render 7 vertical bars labeled D S T Q Q S S. Bar height = avg / max.
   - Small card titled "Por dia da semana", subtitle "Média de gasto por dia".

LAYOUT ORDER (top → bottom inside .subpage-body)
   1. Tendência card (chart + stats + projection)
   2. Budget burn bar (only if budget exists)
   3. Top descrições card
   4. Dia-da-semana card
   5. Existing transactions grouped by fatura

CONSTRAINTS
- No Worker changes. All new computations are client-side from data already loaded (trendsQ, txQ, useDashboard, useBudgets).
- Keep the existing edge-swipe-back gesture and EditingRow behavior intact.
- CSS goes in web/src/styles/tendencias.css. No new stylesheets.
- Mobile-first: chart dots have a hit area ≥ 40px (use invisible padding circles or hitbox overlays).
- Reuse formatBRL from web/src/lib/format.js.
- Read web/src/views/PainelView.jsx for the established card pattern (.summary-card title + subtitle + body).

DONE WHEN
- Opening the drill from a Tendências cell shows: chart card, optional budget bar, top descrições, dia-da-semana, transactions list.
- Tapping a chart dot scrolls the list to the matching fatura and highlights it.
- Tapping a fatura group header highlights the chart dot.
- Per-category projection appears for the current fatura mid-cycle, hidden otherwise.
- Per-category budget bar appears when a budget is set, hidden otherwise.
- Visually consistent with the rest of the app (dark theme, JetBrains Mono numbers, category colors, dim subtitles).
- npm run deploy:pages builds without errors.
```

---

## T2 — Medium-chart annotation pass

**Status**: not started · **Depends on**: T1

### Prompt

```
You're working on Gastos, a single-user mobile-first expense-logger PWA. Read CLAUDE.md at the project root for the full conventions before touching code.

Two medium-sized charts currently render as bare lines with no inline values:
- HeroChart in web/src/views/TendenciasView.jsx (line chart of fatura totals across 12 faturas).
- ReserveSparkline in web/src/views/PainelView.jsx (line chart of projected reserve balance over 24 months).

Add inline value labels + milestones so the chart hands the user the actionable numbers directly.

PREREQ
T1 (Sparkline foundation) must be done. You'll be passing markers and xLabels to <Sparkline />.

WHAT TO BUILD

HeroChart (Tendências tab):
- Markers:
  - 'min' — dot + R$ label
  - 'max' — dot + R$ label
  - 'current' — dot + R$ label in accent color, on the latest fatura
  - 'avg' — horizontal dashed reference line + "média R$X" label at the right edge
- Keep the existing .trend-hero-meta strip (mín / nome / máx). The new in-chart markers complement it.

ReserveSparkline (Painel tab):
- Currently the component shows an endpoint label "Em N meses · R$X". Replace by passing markers:
  - 'current' marker at index 0 with starting balance value.
  - 'current' marker at the last index with ending projected balance value.
  - 'milestone' marker: find the first index in forecast.projection where balance_cents >= reserva_meta_cents. If found, add it at that x with label "meta". Extend the ReserveSparkline prop signature to receive reserva_meta_cents (currently it doesn't).
- Keep the <div class="reserve-meta"> text line in place for now — T5 will overwrite it with an ETA string.

Small charts (Tendências grid CategoryCell): leave unchanged. No markers on the tiny sparklines.

CONSTRAINTS
- All marker rendering happens inside <Sparkline /> from T1. This task is about WHAT to pass. If T1's marker rendering misses a need, extend <Sparkline /> in this task — don't fork it.
- Labels may overlap if min/max happen to land near each other. Accept the overlap for the medium tier — this is a deliberate trade-off.
- Money formatting via formatBRL from web/src/lib/format.js. Default to formatBRL; only consider a compact format (e.g. "R$ 4,2k") if labels visibly crowd in the deployed build.

DONE WHEN
- HeroChart shows min/max/current dots + labels + avg line.
- ReserveSparkline shows start/end dots + a "meta" milestone where the projection crosses the goal.
- Small grid sparklines unchanged.
- npm run deploy:pages builds without errors.
```

---

## T5 — Reserve-goal ETA text

**Status**: not started · **Depends on**: nothing (independent of T2's milestone marker)

### Prompt

```
You're working on Gastos, a single-user mobile-first expense-logger PWA. Read CLAUDE.md at the project root for the full conventions before touching code.

Today the reserve card in web/src/views/PainelView.jsx shows a sparkline + an "Em N meses · R$X" endpoint label. Replace the endpoint label with an actionable ETA: "atinge meta em ~N meses · {Mês AAAA}".

DATA
- useReserveForecast({ months: 24 }) returns { projection: [{ month, deposit_cents, balance_cents }], starting_balance_cents, contribuicao_cents, taxa_mensal_pct }.
- useDashboard(faturaId) provides reserva_meta_cents and reserva_atual_cents.

WHAT TO BUILD
- Compute ETA: walk projection and find the smallest month where balance_cents >= reserva_meta_cents.
- Three render states:
  1. reserva_atual_cents >= reserva_meta_cents → "meta atingida · {Mês AAAA atual}". Skip the ETA computation.
  2. ETA found within 24 months → "atinge meta em ~N meses · {Mês AAAA}". Month label = now() + N months, formatted with new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }). Strip trailing period from locale output.
  3. ETA not found in 24 months → "meta fora do horizonte de 24 meses".
- Render below the sparkline as a small dim line in JetBrains Mono, replacing the existing .reserve-meta endpoint-label content.

WHERE
- Replace the <div class="reserve-meta"><span>{endLabel}</span></div> in the ReserveSparkline (or hoist this text out of the sparkline into the parent reserve card if cleaner — this is display logic, not chart logic).

OUT OF SCOPE
- The "±N months" confidence band. Computing it properly needs historical disponivel_mes variance which no endpoint exposes today. Explicitly deferred.

CONSTRAINTS
- No Worker changes.
- Don't change marker rendering — T2 handles the milestone line at the meta crossing.
- Handle forecastQ.data === undefined (still loading) — render nothing or "—".

DONE WHEN
- Painel reserve card shows ETA text below the sparkline.
- All three states render correctly: meta atingida / atinge em N meses / fora do horizonte.
- npm run deploy:pages builds without errors.
```

---

## T4 — History faixa-de-valor filter

**Status**: not started · **Depends on**: nothing

### Prompt

```
You're working on Gastos, a single-user mobile-first expense-logger PWA. Read CLAUDE.md at the project root for the full conventions before touching code.

The History tab (web/src/views/HistoryView.jsx) supports filter by fatura (select), search (descrição substring, debounced server-side), and categoria pills (client-side toggle). Add a value-range filter (mín / máx in R$).

WHAT TO BUILD
- A new chip in the .history-filter row next to the search button: "Valor".
- Tapping opens an inline popover with two BRL inputs: mín and máx. Both optional. Tapping outside or pressing Enter closes the popover. An × clear button inside resets both fields.
- Filter is CLIENT-SIDE over the already-fetched rows (matches the categoria-pill pattern). Apply alongside the existing categoria filter in the visible useMemo:
    keep iff (min == null || Math.abs(r.valor_cents) >= min) && (max == null || Math.abs(r.valor_cents) <= max)
  Use Math.abs so reembolsos (negative valor_cents) match the same range as positive expenses. Add a one-line comment with the why next to the Math.abs.
- The chip displays the active range when set:
    both bounds   → "R$ 50 – R$ 200"
    only min      → "≥ R$ 50"
    only max      → "≤ R$ 200"
    neither set   → "Valor"
- Update filterActive so it's true when either bound is set. Update the existing .history-status "Mostrando X de Y" line to reflect the post-filter count.

INPUT UX
- Inputs accept digits with one decimal separator (comma or period). Convert to cents on submit. Reuse the BRL input parsing patterns from web/src/views/AddView.jsx if available; otherwise write a small local helper.
- Format on blur with formatBRL (web/src/lib/format.js).

CONSTRAINTS
- No Worker changes. listTx already handles 500-row fetches; client-side filtering is fine at this scale.
- No new signals. Keep range state as useState inside HistoryView.
- Don't touch "vendor" — that's a separate deferred task.

FILES
- web/src/views/HistoryView.jsx
- web/src/styles/history.css

DONE WHEN
- A "Valor" chip appears in History, opens a min/max popover.
- Typing a range filters the visible list immediately.
- Status line shows the filtered count correctly.
- Chip displays the active range as a compact label.
- npm run deploy:pages builds without errors.
```
