-- Faturas (credit-card billing cycles)
CREATE TABLE faturas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT NOT NULL UNIQUE,
  start_date    TEXT NOT NULL,
  salario_cents INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX faturas_start_date ON faturas(start_date);

-- Transactions
CREATE TABLE transactions (
  id                   TEXT PRIMARY KEY,
  data                 TEXT NOT NULL,
  descricao            TEXT NOT NULL,
  valor_cents          INTEGER NOT NULL,
  categoria            TEXT NOT NULL,
  fatura_id            INTEGER REFERENCES faturas(id) ON DELETE SET NULL,
  notes                TEXT,
  manually_categorized INTEGER NOT NULL DEFAULT 0,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL,
  deleted_at           INTEGER
);
CREATE INDEX transactions_fatura ON transactions(fatura_id) WHERE deleted_at IS NULL;
CREATE INDEX transactions_categoria ON transactions(categoria) WHERE deleted_at IS NULL;
CREATE INDEX transactions_data ON transactions(data) WHERE deleted_at IS NULL;

-- Merchant categorization rules
CREATE TABLE merchant_rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chave       TEXT NOT NULL,
  categoria   TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX merchant_rules_position ON merchant_rules(position);

-- Settings (singleton — only row id=1)
CREATE TABLE settings (
  id                         INTEGER PRIMARY KEY CHECK (id = 1),
  meta_investimento_pct      REAL    NOT NULL DEFAULT 0.25,
  reserva_atual_cents        INTEGER NOT NULL DEFAULT 0,
  reserva_meta_multiplier    REAL    NOT NULL DEFAULT 6.0,
  taxa_juros_mensal_pct      REAL    NOT NULL DEFAULT 0.0,
  fechamento_dia             INTEGER NOT NULL DEFAULT 31,
  current_fatura_override_id INTEGER REFERENCES faturas(id),
  updated_at                 INTEGER NOT NULL
);
INSERT INTO settings (id, updated_at) VALUES (1, strftime('%s','now')*1000);
