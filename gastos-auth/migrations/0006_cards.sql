-- Cartão (payment card) per transaction. Cards live as JSON in
-- settings.cards: [{name, color}], same shape as custom_categories.
ALTER TABLE settings ADD COLUMN cards TEXT NOT NULL DEFAULT '[]';
ALTER TABLE transactions ADD COLUMN cartao TEXT;

UPDATE settings SET cards = '[
  {"name":"Itaú Plat","color":"#e08a3c"},
  {"name":"Itaú Latam Pass","color":"#d4af37"},
  {"name":"Ultravioleta","color":"#4b1d6e"}
]' WHERE id = 1;

UPDATE transactions SET cartao = 'Itaú Plat' WHERE descricao LIKE '[Itaú 0947]%';
UPDATE transactions SET cartao = 'Itaú Latam Pass' WHERE descricao LIKE '[Itaú 7971]%';
UPDATE transactions SET cartao = 'Ultravioleta' WHERE cartao IS NULL;
