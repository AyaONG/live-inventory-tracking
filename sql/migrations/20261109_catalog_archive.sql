-- Final R1: catalogue removal without loss of warehouse or sales history.
-- Safe additive migration. Run on inventory_db only, NOT against ayazhan_inventory.
-- DO NOT run sql/schema.sql or seed.js: they may reset existing data.
BEGIN;
ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_by INT REFERENCES users(user_id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_products_active_catalog ON products(product_id) WHERE archived_at IS NULL;
CREATE TABLE IF NOT EXISTS product_catalog_events (
  catalog_event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
  performed_by INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  action VARCHAR(12) NOT NULL CHECK (action IN ('archived','restored')),
  stock_at_event INT NOT NULL CHECK (stock_at_event >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_events_product ON product_catalog_events(product_id, catalog_event_id DESC);
COMMIT;
