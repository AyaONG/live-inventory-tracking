-- Inventory tracking system for small electronics stores
-- PostgreSQL schema. Safe to re-run: it drops and recreates all tables.

DROP TABLE IF EXISTS alerts, stock_movements, product_suppliers,
                     products, suppliers, categories, users CASCADE;

CREATE TABLE users (
    user_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(100) NOT NULL,                 -- bcrypt hash, never the password itself
    role           VARCHAR(20)  NOT NULL CHECK (role IN ('owner', 'employee')),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE categories (
    category_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name           VARCHAR(80)  NOT NULL UNIQUE
);

CREATE TABLE suppliers (
    supplier_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name           VARCHAR(120) NOT NULL UNIQUE,
    phone          VARCHAR(30),
    email          VARCHAR(255)
);

CREATE TABLE products (
    product_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku                VARCHAR(30)  NOT NULL UNIQUE,
    name               VARCHAR(150) NOT NULL,
    category_id        INT NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,
    price              NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    quantity           INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reorder_threshold  INT NOT NULL DEFAULT 5 CHECK (reorder_threshold >= 0),
    photo_url          TEXT
);

-- Linking table: one product can have several suppliers, one supplier supplies many products
CREATE TABLE product_suppliers (
    product_id      INT NOT NULL REFERENCES products(product_id)  ON DELETE CASCADE,
    supplier_id     INT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE RESTRICT,
    supplier_price  NUMERIC(10,2) NOT NULL CHECK (supplier_price >= 0),
    PRIMARY KEY (product_id, supplier_id)
);

CREATE TABLE stock_movements (
    movement_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id       INT NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    user_id          INT NOT NULL REFERENCES users(user_id)       ON DELETE RESTRICT,
    quantity_change  INT NOT NULL CHECK (quantity_change <> 0),
    reason           VARCHAR(20) NOT NULL CHECK (reason IN ('sale', 'delivery', 'correction')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alerts (
    alert_id           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id         INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    quantity_at_alert  INT NOT NULL CHECK (quantity_at_alert >= 0),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_resolved        BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_movements_product ON stock_movements(product_id);
CREATE INDEX idx_alerts_open       ON alerts(product_id) WHERE is_resolved = false;
