# Final analytics — method and limits (Ar. Kobzhassarova)

**Source:** operational `inventory_db`, not the historical Assignment 3 snapshot `ayazhan_inventory`. Synthetic coursework data, not commercial transactions.

## Business questions, evidence and actions

| Question | Measure | Decision | Caveat |
|---|---|---|---|
| Which products sell most? | Count of units in negative `sale` stock movements in a selected complete-day window | Check priority products for replenishment | Not the same as revenue or true demand if products were out of stock |
| When does outbound sales movement increase? | Units sold per completed day, with zero-sale days retained | Review busy days and compare periods | Doesn't prove seasonality |
| Which SKUs are at risk? | Current quantity relative to reorder threshold and conditional days of cover | Review first in Replenishment | Dates are scenarios, not guarantees; supplier lead time is user-provided |
| Which lines lack recorded sales? | Quantity positive and no recorded `sale` | Check data coverage, merchandising and buying frequency | Not proof of dead stock |
| How much is currently listed? | Current `price × quantity` | Understand retail-listed exposure | Not profit, not realized revenue or acquisition cost |

## Rules

- Sales are negative movements with `reason = 'sale'`. Positive deliveries and corrections are excluded.
- Periods: 7, 30, 90 *complete* days in Asia/Almaty timezone. Current stock is read now; do not imply historical stock.
- Rate = recorded sold units ÷ selected days, including days with zero recorded sales.
- Days of cover = current stock ÷ recorded average daily sales, only if at least 5 sale events across 3 days and history covers the selected period. This criterion is a cautious display guard, NOT proof of an accurate forecast.
- Replenishment quantity is a planning scenario, not an order and not a stock movement. It assumes no incoming shipments and uses user-supplied lead/review/buffer days.
- Generated End-term analysis slides and A3 archived reports must be labeled as separate datasets.

## Local reproducible checks

From repository root with PostgreSQL running:

```bash
node --test tests/final_analytics_logic.test.cjs
node tools/final_analytics_audit.cjs
```

The audit reads data for each period in read-only transactions and checks totals against the line-chart dataset. Output: `endterm_output/final_analytics_audit.json` (do not commit raw data until reviewed for sensitivity). Record actual values, date, database, screenshot and commit in the final report.

## What not to claim

Do not claim real cash earnings, retail turnover ratio, average supplier lead time, customer demand, or 99% availability unless the missing primary data and comparable measurements actually exist.
