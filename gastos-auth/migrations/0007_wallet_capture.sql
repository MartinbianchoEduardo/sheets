ALTER TABLE transactions ADD COLUMN source TEXT;
ALTER TABLE transactions ADD COLUMN capture_id TEXT;
CREATE UNIQUE INDEX idx_transactions_capture_id ON transactions(capture_id);
ALTER TABLE settings ADD COLUMN capture_key_hash TEXT;
ALTER TABLE settings ADD COLUMN capture_key_created_at INTEGER;
