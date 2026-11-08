# Final Project — Requirements Status (code baseline: main, PR #6)

**Stockroom, SE-2626 · 9 November 2026**

Status uses three meanings: **Implemented** = feature is in the merged source and is supported by a code or prior demonstration; **Accepted** = a specific user or browser scenario is documented with evidence; **Outside scope** = not implemented as a production capability. This distinction avoids presenting automated tests as measured human performance.

| ID | Priority | Stage 2 | Current Final status | Evidence / implementation |
|---|---|---|---|---|
| R1 Product lifecycle (create, edit, remove) | Must | Partly | **Implemented; functional workflow demonstrated** | PR #3 product API, PR #5 archive/restore at any quantity with history retained, PR #6 integrated UI; 35/35 combined code checks; developer confirmed site functioning. “Remove from catalog” is soft delete, not destructive row removal. |
| R2 Sales, deliveries, corrections | Must | Done (scenario) | **Implemented** | Transactional movements and live stock; Stage 2 external Seller updates recorded at 3 s / 5 s. |
| R3 Employee/owner sign-in | Must | Done (demo) | **Implemented** | bcrypt + server role checks; Seller and Administrator paths present. |
| R4 Low-stock warning and threshold change | Must | Partly | **Implemented, latency benchmark from Stage 2** | Owner alerts and editable threshold; Stage 2 owner-warning observations 1 s / 2 s. |
| R5 Search by name/category/barcode | Could | Partly | **Implemented for UI search and barcode simulation** | Stockroom search/filter; simulator is software, not camera capture. |
| R6 Export inventory and movements | Should | Partly | **Implemented; stock CSV inspected** | Stage 2/Final analyst verified stock CSV; movements export endpoint exists; no separate final row-by-row audit supplied. |
| R7 Camera barcode lookup | Could | Not started | **Outside scope** | Browser barcode simulator provided instead; no physical or camera scanner. |
| R8 E-mail alert | Should | Not started | **Outside scope** | On-screen low-stock alerts, no e-mail delivery service configured. |
| R9 Search/refresh under 2 s | Must | Partly | **Functional; timed performance assessment not recorded for final build** | Stage 2 had three non-comparable observations below 2 s, not a controlled final benchmark. |
| R10 Password hashing/access/HTTPS | Must | Partly | **Implemented in demonstration boundary** | bcrypt, parameterised queries, permissions; HTTPS through temporary Cloudflare tunnel; local development remains HTTP. |
| R11 360 px usability + ≥8/10 unaided success | Must | Partly | **Mobile UI integrated; three additional task completions reported** | Six Stage 2 external testers, 5/6 first attempts; three additional final participants reported successful. Their unaided first-attempt counts and native 360 px widths were not separately reported. |
| R12 Seven-day service availability | Should | Not started | **Outside assessed scope** | Local Mac demo + temporary tunnel, not continuously hosted. |
| R13 Public catalogue + sync stamp | Must | Done (read) | **Implemented** | Public price, availability and sync timestamp; verify through Buyer/Guest live demonstration. |

## Baseline and evidence
- Six merged team pull requests (#1–#6): https://github.com/AyaONG/live-inventory-tracking/pulls?q=is%3Apr+is%3Aclosed
- Integrator's Node suite: 35 passed, 0 failed, after resolving PR #6 conflict.
- Stage 2: four Buyers searched in 10, 12, 20 and 20 seconds; Seller updates 3 and 5 seconds.
- Three additional non-team participants completed final tasks as reported by the team. Individual timestamps, browser models and exact durations have not been supplied in this chat and are not inferred.

**Reporting convention:** “Accepted” is not applied automatically from a merged PR. The original 8/10 target concerns **unaided first attempts**, not overall task completion.
