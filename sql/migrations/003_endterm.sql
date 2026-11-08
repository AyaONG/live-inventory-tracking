-- Incremental extension only. No table reset and no replacement of existing stock.
CREATE TABLE IF NOT EXISTS product_barcodes (
 barcode VARCHAR(80) PRIMARY KEY,
 product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
 is_simulated BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO product_barcodes(barcode,product_id)
SELECT 'DEMO-'||sku,product_id FROM products ON CONFLICT(barcode) DO NOTHING;
CREATE TABLE IF NOT EXISTS scan_events (
 event_id UUID PRIMARY KEY,
 barcode VARCHAR(80) NOT NULL,
 device_id VARCHAR(60) NOT NULL,
 source VARCHAR(20) NOT NULL DEFAULT 'simulation' CHECK(source='simulation'),
 product_id INT REFERENCES products(product_id) ON DELETE RESTRICT,
 user_id INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 movement_id INT UNIQUE REFERENCES stock_movements(movement_id) ON DELETE RESTRICT,
 confirmed_change INT, confirmed_reason VARCHAR(20), resulting_quantity INT,
 confirmed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_scans_user_time ON scan_events(user_id,created_at DESC);
