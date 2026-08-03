-- Custom categories added via Config: JSON array of {name, color}.
ALTER TABLE settings ADD COLUMN custom_categories TEXT NOT NULL DEFAULT '[]';
