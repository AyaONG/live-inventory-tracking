# Final User Testing and Acceptance Summary

**Project:** Stockroom — Live Inventory Tracking and Low-Stock Alerts for Small Electronics Stores  
**Course / group:** ICT / SE-2626  
**Technical baseline:** merged `main` after PR #6, 9 November 2026

## Executive result
The team completed a three-person additional external-user testing round of the integrated Stockroom interface and reported successful task completion for all three non-team users (3/3). The post-integration developer regression suite passed **35/35 automated checks**, covering product archive/restore contracts, barcode scan/confirm/retry, analytics safeguards, UI contracts, and video moderation. These complementary results support the functioning end-to-end coursework prototype.

The Stage 2 record contains **six distinct external testers** and separately measured time results. Stage 2 users tested a previous build, so its timing baseline is retained in a separate column rather than passed off as measurements of the final build.

## Success-criterion comparison

| Original Stage 1 criterion | Target | Stage 2 evidence (recorded) | Final integrated-build result |
|---|---|---|---|
| Customer price and availability search | Under 30 s | Four Buyers: 10, 12, 20, 20 s; mean 15.5 s | Three additional external tasks completed successfully (team-reported); final search seconds not individually logged |
| Seller update, public visibility and owner alert | Update under 20 s; visibility and alert within 60 s | Two external Sellers: update 3/5 s; buyer visibility 6/5 s; owner warning 1/2 s | Workflow integrated in final system; 35/35 contract/regression checks passed; no comparable final session timings supplied |
| Mobile layout and first-attempt independence | 360 CSS px; at least 8/10 succeed unaided on first try | Five of six external Stage 2 first attempts succeeded; phones used | Three additional users completed assigned tasks successfully; first-attempt/no-help field and exact CSS viewport were not separately recorded |
| Search and refresh performance (R9) | Under 2 s in controlled measurements | Three different observations below 2 s, not identical conditions | Final timing series not supplied; no numeric final latency is asserted |

## Human testing record — Final round

| Test ID | Tester relationship | Recorded final result | What can be claimed |
|---|---|---|---|
| F-U01 | Outside team (team-reported) | Task completed successfully | Completion only; no time or device attributed |
| F-U02 | Outside team (team-reported) | Task completed successfully | Completion only; no time or device attributed |
| F-U03 | Outside team (team-reported) | Task completed successfully | Completion only; no time or device attributed |

**Final round completion rate:** 3/3 (100% of the three team-reported sessions). This is a descriptive completion rate for three users, **not** a claim that the original 8/10 unaided-first-attempt target was measured on ten final-build users.

## Regression and engineering validation
- `node --test tests/*.test.cjs`: **35 tests passed, 0 failed**, recorded by the developer after integration conflict resolution.
- Create/Edit/Archive/Restore: administrator UI and backend integrated (PR #3 and #5), retaining quantity and stock history.
- UI integration: Barcode Simulator and Historical A3 reports connected to the final Stockroom navigation (PR #6).
- Analytics unit tests: 5/5 passed on analyst's Windows environment; stock CSV was downloaded and inspected.
- The final system is a **functional coursework prototype**, run with local PostgreSQL and optional Cloudflare Quick Tunnel; not an always-on cloud service.

## Evidence references
- GitHub PRs: https://github.com/AyaONG/live-inventory-tracking/pulls?q=is%3Apr+is%3Aclosed
- `tests/` in the repository; developer console log of 35/35 tests.
- Original measured timings and first-attempt outcomes: `Group_Team_ICT_ProjectStage2-2.pdf`, Part B.
- Final three-user outcomes: reported by the SE-2626 team in the final integration handoff; add anonymized primary records if available.

## Interpretation
Final delivery addresses the originally observed customer search and staff stock problems. The result is supported by working software, merged team contributions, measured Stage 2 benchmarks and three subsequent successful external task completions. Results are reported by source/build so that an examiner can distinguish actual timed observations from a final functional check.
