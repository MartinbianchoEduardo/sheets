-- Recurring expenses (Step 5 of docs/FEATURES_PLAN.md). User-managed template
-- list; matching against actual transactions is read-only and heuristic.

CREATE TABLE recurring_expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao   TEXT NOT NULL,
  valor_cents INTEGER NOT NULL,
  categoria   TEXT NOT NULL,
  dia_do_mes  INTEGER NOT NULL CHECK (dia_do_mes BETWEEN 1 AND 31),
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX recurring_active ON recurring_expenses(active);
