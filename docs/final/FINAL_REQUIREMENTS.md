# Final requirement status — complete with real evidence before LMS

From Stage 2 report, **statuses below are the Stage 2 snapshot**, not promises about Final. After code freeze run each acceptance test and fill the last two columns. Every unfinished item gets a one-sentence justification.

| ID | Requirement (Stage 1/2) | Priority | Stage 2 | Final status | Link / screenshot / test |
|---|---|---|---|---|---|
| R1 | Create, edit and delete product records | Must | Partly | Partly | Source-code review confirmed that Read and Update are implemented, while Create and Delete are missing. Developer and UI fixes pending; full CRUD retest required. |
| R2 | Record sales, deliveries and corrections | Must | Done (demonstrated path) | Partly | Sale operation form verified; stock preview correctly shows 86 to 85 for one unit. Delivery, correction and database persistence not yet verified. |
| R3 | Staff/owner email-password login | Must | Done (demo) | TBD | TBD |
| R4 | Low-stock alerts and editable thresholds | Must | Partly | TBD | TBD |
| R5 | Search by name/category/barcode | Could | Partly | TBD | TBD |
| R6 | Export current stock and recent changes | Should | Partly | Partly | Stock CSV downloaded and verified: SKU, name, category, price, quantity and reorder threshold. Recent changes export not tested. |
| R7 | Camera barcode lookup | Could | Not started | TBD | TBD |
| R8 | Email when product runs out | Should | Not started | TBD | TBD |
| R9 | Search/refresh under two seconds | Must | Partly | TBD | TBD |
| R10 | Password hashes, controlled access, HTTPS | Must | Partly | TBD | TBD |
| R11 | Usable at 360 px and 8/10 original success | Must | Partly | TBD | TBD |
| R12 | Shop-hours availability target | Should | Not started | TBD | TBD |
| R13 | Public price/availability lookup and sync time | Must | Done (read scope) | TBD | TBD |

**Important:** the Final brief requests *all Must requirements done*. Claim Done only with concrete test evidence. If you cannot complete a requirement, disclose the gap. Do not fabricate screenshots or participants.
