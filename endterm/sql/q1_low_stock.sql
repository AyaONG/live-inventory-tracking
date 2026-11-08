-- A3 source: include categories with zero low-stock product lines.
SELECT c.category_id, c.name AS category,
       COUNT(p.product_id)::int AS product_count,
       COUNT(p.product_id) FILTER (WHERE p.quantity <= p.reorder_level)::int AS low_stock_count,
       ROUND(100.0 * COUNT(p.product_id) FILTER (WHERE p.quantity <= p.reorder_level)
             / NULLIF(COUNT(p.product_id), 0), 2) AS low_stock_percent
FROM categories c LEFT JOIN products p ON p.category_id=c.category_id
GROUP BY c.category_id,c.name ORDER BY low_stock_count DESC,c.name;
