-- Current quantity at listed retail prices, NOT revenue, cost or profit.
SELECT c.category_id,c.name AS category,
       COALESCE(SUM(p.quantity),0)::bigint AS units_on_hand,
       COALESCE(SUM(p.quantity*p.price_kzt),0)::numeric(18,2) AS stock_value_kzt
FROM categories c LEFT JOIN products p ON p.category_id=c.category_id
GROUP BY c.category_id,c.name ORDER BY stock_value_kzt DESC,c.name;
