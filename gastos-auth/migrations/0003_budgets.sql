-- Global per-category budgets. One row per categoria. Missing rows mean
-- "no budget set" — not an error. Budget is a single monthly target reused
-- every fatura; per-fatura overrides are out of scope.

CREATE TABLE category_budgets (
  categoria   TEXT PRIMARY KEY,
  valor_cents INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
