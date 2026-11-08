# As-built architecture — verify against actual final code (A2)

```text
Buyer / Seller / Administrator browser
   |
   | HTTPS only when visiting via temporary Cloudflare Quick Tunnel
   | Local testing: HTTP on localhost:3000
   v
Node.js / Express API on developer's Mac
   |-- publicly readable catalogue and published videos
   |-- session cookie + server-side role checks for private operations
   |-- parameterized SQL and transactions for stock changes
   |-- /api/studio/analytics with Administrator authorization (read-only)
   |-- /endterm.html simulated barcode identification and confirmation
   |-- media upload validation using FFprobe
   |           |
   |           +--> local storage/videos/*.mp4 (not a PostgreSQL BLOB)
   v
PostgreSQL inventory_db on developer's Mac
   |-- users, products, categories, suppliers, product_suppliers
   |-- stock_movements, alerts, product_videos, video_review_events
   |-- optional simulation: product_barcodes, scan_events

Separate: ayazhan_inventory = historical A3 research records, not a migrated part of current store.
```

**Security boundary:** the browser is untrusted; backend validates credentials/roles before changing protected data. External tunnel encrypts visitor-to-tunnel traffic with HTTPS; do not imply the local app uses HTTPS internally. Do not commit secrets, `storage/videos` or a real DB backup.

## Changes from Stage 1 (recheck original report)

| Design element | Original plan | Actual implementation | Reason |
|---|---|---|---|
| Backend | Flask/Python A3 prototype | Express/Node.js final | Integrated A4 multimedia/role-based scaffold; **not** because Flask cannot handle video |
| Data | A3 `ayazhan_inventory` | Operational A4 `inventory_db` + separate A3 archive | Different development data layers; do not claim migration |
| Frontend | Initial UI and wireframes | Stockroom workspace + same-theme coursework routes | User testing found dense text and hidden actions |
| Hosting | Proposed options in Stage 1 | Mac local server + temporary Cloudflare tunnel | Available coursework demonstration infrastructure; not full production availability |
| IoT | Proposed connected device | Browser simulation with confirmation | No physical scanner; clearly distinguish proposed hardware |
| Product videos | Multimedia extension | Validated upload, moderated state transitions and local MP4 storage | Prevent unreviewed buyer-visible media |
| Analytics | SQL/analyst charts | Admin-only live `inventory_db` scenarios + separate preserved coursework charts | Actionable replenishment review without inventing missing business data |

**Confirm every row with the real files and final screenshots; if the Stage 1 plan differs, update the table.**
