-- Queries for the defense. Run in psql, DBeaver or DataGrip.

-- 1. Count products per category (GROUP BY)
SELECT c.name AS category, COUNT(*) AS products
FROM products p JOIN categories c ON c.category_id = p.category_id
GROUP BY c.name ORDER BY products DESC;

-- 2. Count stock movements per reason
SELECT reason, COUNT(*) FROM stock_movements GROUP BY reason;

-- 3. Products at or below their reorder threshold (the low-stock list)
SELECT sku, name, quantity, reorder_threshold FROM products WHERE quantity <= reorder_threshold ORDER BY sku;

-- 4. Proof that passwords are hashed (bcrypt hashes start with $2a$10$)
SELECT email, role, password_hash FROM users LIMIT 3;

-- 5. Foreign key behaviour: this fails because the category still has products (ON DELETE RESTRICT)
-- DELETE FROM categories WHERE category_id = 1;

-- 6. CHECK constraint behaviour: this fails because stock cannot be negative
-- UPDATE products SET quantity = -5 WHERE product_id = 1;

-- 7. Many-to-many: suppliers of one product through the linking table
SELECT p.sku, p.name, s.name AS supplier, ps.supplier_price
FROM products p JOIN product_suppliers ps ON ps.product_id = p.product_id
JOIN suppliers s ON s.supplier_id = ps.supplier_id
WHERE p.product_id = 1;

-- 8. Row counts of all tables (evidence for the test-data requirement)
SELECT 'users' AS table_name, COUNT(*) FROM users UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers UNION ALL SELECT 'products', COUNT(*) FROM products
UNION ALL SELECT 'product_suppliers', COUNT(*) FROM product_suppliers
UNION ALL SELECT 'stock_movements', COUNT(*) FROM stock_movements UNION ALL SELECT 'alerts', COUNT(*) FROM alerts;
