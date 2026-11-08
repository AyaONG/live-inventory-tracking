# Stockroom — Final ICT Project (SE-2626)

**Live Inventory Tracking and Low-Stock Alerts for Small Electronics Stores**  
Astana IT University · ICT Final Project · November 2026  
Completed functional **coursework prototype**; synthetic data, not a production store.

## GitHub and team
- [Repository](https://github.com/AyaONG/live-inventory-tracking) — select `main`, containing merged PRs #1–#6.
- Ayazhan Ongdakanova — Developer: API, PostgreSQL, archive, video Publish, integration.
- Aruzhan Zhekebayeva — Frontend: unified Stockroom, barcode and historical-report UI.
- Aruzhan Kobzhassarova — Analyst: metric logic, requirements, testing documentation.

## What works and what remains outside scope
Stockroom provides Buyer/Guest catalogue access, authenticated Seller stock updates, Administrator product management, archive/restore with preserved history, threshold alerts, moderated local MP4 video, live analytics, separate A3 reporting and a **simulated** barcode scan/confirm workflow. This does **not** include physical-camera barcode capture, payment, delivery, real supplier orders or guaranteed cloud availability.

## Requirements
- Node.js LTS, PostgreSQL (local `inventory_db`), optional FFmpeg/FFprobe for video upload.
- The original working database and `storage/videos/*.mp4` are **not** in GitHub. A fresh clone cannot reproduce your existing records and videos without a sanitized database snapshot and separately approved media assets.
- Existing Mac data: `~/Downloads/stockroom-final`; start **Postgres.app**, then:

```bash
cd "$HOME/Downloads/stockroom-final"
git switch main
git pull --ff-only origin main
npm ci
npm start
```

Open `http://localhost:3000/workspace.html` (Stockroom). Use the built-in tabs for Inventory, Analytics, Barcode Simulator, Media and archived items. `http://localhost:3000` may redirect to the workspace depending on server configuration.

**Never run `npm run schema`, `node seed.js` or reset SQL on the working database.** These can destroy live coursework records. The catalogue-archive migration was applied on the developer Mac after a backup; a new database environment needs the appropriate schema and migration sequence checked before use.

## Demonstration roles (synthetic accounts only)
| Role | Email | Access |
|---|---|---|
| Administrator | `owner@shop.example` | Product management, archive/restore, analytics, moderation |
| Seller | `employee1@shop.example` | Stock changes, operational features and eligible media actions |
| Buyer | `customer@shop.example` | Public catalogue and published videos |

**Share demo credentials directly with the instructor through a private channel.** The current demo mode may expose demo account details; do not use real personal/customer data or treat it as production security.

## Verification

```bash
node --test tests/*.test.cjs
node tools/final_video_preflight.cjs
node tools/final_analytics_audit.cjs
```

The last two inspect the developer's local PostgreSQL and files. Integration transcript on 9 November 2026: 35 automated checks passed, 0 failed. The live system was exercised by the developer and three additional non-team participants (team-reported), while the Stage 2 report provides separately measured timing benchmarks. For a reproducible defense, retain the latest screenshot/log of each role-specific workflow.

## Temporary external link
Optional test session: keep PostgreSQL and `npm start` running, then in another terminal run:

```bash
cloudflared tunnel --url http://localhost:3000
```

Share only the generated `https://...trycloudflare.com` URL; it changes on restart. Stop the tunnel after testing. The project is **not permanently hosted**. The Final assignment accepts exact local-run instructions instead of a public deployment.

## Data and architecture
Browser → Express API (`localhost:3000`) → `inventory_db` PostgreSQL. Uploaded MP4 files are stored under local `storage/videos/`; their metadata is in PostgreSQL. Historical Assignment 3 source `ayazhan_inventory` is separate from the operational database. Client-facing tunnel traffic uses HTTPS, while the local development server uses HTTP.

## Evidence and limits
See `docs/final/FINAL_REQUIREMENTS.md`, `docs/final/FINAL_TEST_SUMMARY.md` and the submitted Final report for the current requirement matrix, as-built architecture and results. Six team PRs are merged. The final code-integration transcript shows 35/35 automated checks passed. Three additional external testers completed assigned tasks as reported by the analyst; participant-level timing and 360 px checks should be added only if recorded.
