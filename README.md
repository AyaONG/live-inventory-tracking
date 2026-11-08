# Inventory tracking with low-stock alerts (small electronics stores)

Prototype for ICT Assignment 3: PostgreSQL database + Node.js/Express API + simple web page.

## Requirements
- PostgreSQL 16 or newer (Postgres.app on Mac), running on port 5432
- Node.js 18 or newer (https://nodejs.org, LTS version)

## Run (Mac, Postgres.app)
```
npm install
createdb inventory_db
psql -d inventory_db -f sql/schema.sql
node seed.js
npm start
```
Open http://localhost:3000 and log in:
- owner@shop.example / Demo1234!  (all test accounts use the same demo password; it is stored only as a bcrypt hash)

## Other database settings
Set `DATABASE_URL`, for example `DATABASE_URL=postgresql://user:password@localhost:5432/inventory_db npm start`

## What is where
- `sql/schema.sql` - CREATE TABLE statements with all constraints
- `seed.js` - loads 120 products and test data in all other tables
- `server.js` - API: login (bcrypt), read products, write stock change, alerts
- `public/index.html` - web interface
- `docs/queries.sql` - queries used in the report and at the defense

## Backup and restore
```
pg_dump inventory_db > backup.sql
createdb inventory_restore
psql -d inventory_restore -f backup.sql
```

## Assignment 4 (multimedia)
- `public/img/` logo and icon sprite (SVG); `public/img/optimised/` WebP photos; `public/img/original/` full-size photos for the "before" measurement
- `public/media/alert.wav` notification sound (played only after the user presses Save and ticks the sound checkbox)
- Open `http://localhost:3000/?raw=1` to load the original photos (before optimisation), `http://localhost:3000/` for the optimised ones
- `tools/optimise.py` converts photos from `originals/` to WebP; `tools/experiment.py` runs the format experiment; `tools/contrast.py` checks colour contrast; `tools/make_sound.py` creates the alert sound
- Python tools need Pillow: `pip3 install pillow numpy`

<!-- FINAL-TEAM-README-START -->

## Final Project — Stockroom (SE-2626)

**Live Inventory Tracking and Low-Stock Alerts for Small Electronics Stores**. Coursework demonstration on Node.js/Express, PostgreSQL, HTML/CSS/JavaScript, image/video media and a browser barcode simulator. Synthetic product data.

### Local requirements

Node.js LTS, PostgreSQL with a restored **coursework** `inventory_db` (not committed to GitHub), FFmpeg/FFprobe for new MP4 uploads. Run `npm ci`, then `npm start`. Open `http://localhost:3000` (Stockroom), `/endterm.html` (barcode simulator), `/analysis.html` (saved coursework reports).

**Database warning:** existing Mac data already includes products, movements and video metadata. `npm run schema` and `npm run seed` reset/reseed data — never run them on the working database. Other teammates can review the frontend, tests and code without recreating this database. Coordinate a sanitized, explicitly authorized demo-only database if independent live startup is required.

### Demo accounts / role descriptions

| Role | Coursework login | Rights |
|---|---|---|
| Administrator | `owner@shop.example` | management, analytics, moderation |
| Seller | `employee1@shop.example` | stock movements, video submission |
| Buyer | `customer@shop.example` | catalogue, published videos |

**Do not commit production secrets.** Demo password is shared privately with the instructor, not published in a public repository. Demo credentials are not production-ready. When operating a public Cloudflare Tunnel, use only synthetic content and shut it down after demonstration. The current sample implementation may disclose demo login details at `/api/config` in demo mode; do not treat it as production security.

### Architecture (as built)

Browser (public catalogue and role-dependent Stockroom views) ↔ local Express API (`localhost:3000`) ↔ PostgreSQL `inventory_db`. Stored MP4 content is in `storage/videos/` on the local Mac; video metadata and moderation history reside in PostgreSQL. Public external HTTPS uses a **temporary Cloudflare Quick Tunnel**; Express locally is HTTP. A3 historical `ayazhan_inventory` is a separate analytical source, not a migrated live dataset. The barcode workflow is a **browser simulation**, not connected camera or wireless scanner.

### Team responsibilities and GitHub evidence

- **Aruzhan Zhekebayeva — Designer / Frontend:** unified styling of Workbench, historic reporting and classic catalogue; mobile and accessibility review.
- **Ayazhan Ongdakanova — Developer:** application integration, SQL/API video moderation repair, deployment and verification.
- **Aruzhan Kobzhassarova — Analyst:** live business metric audit, requirement status and final external-user test evidence.

Everyone works in their own `feature/...` branch and creates a Pull Request into `main`. Record individual commits under each member's own GitHub-linked email, and explain them at the individual defense.

### Verification

```bash
node --test tests/video_publish_contract.test.cjs tests/final_analytics_logic.test.cjs
node tools/final_video_preflight.cjs
node tools/final_analytics_audit.cjs
```

The last two require the local PostgreSQL and are read-only. For video Publish, run an additional manual live acceptance scenario with an existing Pending clip. For Final, verify three non-team users and original Stage 1 success criteria; include dated screenshots and exact data sources in the report.

<!-- FINAL-TEAM-README-END -->
