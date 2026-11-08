-- All recorded history. Counts units, not just number of delivery operations.
SELECT c.category_id,c.name AS category,
       COUNT(m.movement_id)::int AS delivery_operations,
       COALESCE(SUM(m.change_qty),0)::bigint AS units_received
FROM categories c
LEFT JOIN products p ON p.category_id=c.category_id
LEFT JOIN stock_movements m ON m.product_id=p.product_id
  AND m.reason='delivery' AND m.change_qty>0
GROUP BY c.category_id,c.name ORDER BY units_received DESC,c.name;
