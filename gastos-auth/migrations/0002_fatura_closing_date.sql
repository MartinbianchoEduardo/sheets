-- Per-fatura closing date. Replaces the derived "closing day from settings"
-- model — each fatura now carries its own explicit closing_date so the cycle
-- bounds are unambiguous and editable per row.

ALTER TABLE faturas ADD COLUMN closing_date TEXT;

-- Backfill existing rows so the app keeps working after migration. Mirrors the
-- previous algorithm: next fatura's start - 1 day, falling back to start + 30.
UPDATE faturas SET closing_date = (
  SELECT date(f2.start_date, '-1 day') FROM faturas f2
  WHERE f2.start_date > faturas.start_date
  ORDER BY f2.start_date ASC LIMIT 1
);
UPDATE faturas SET closing_date = date(start_date, '+30 days')
  WHERE closing_date IS NULL;
