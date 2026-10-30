-- perform/02-explain.sql — run it for real, and count what each step touched.
-- ANALYZE runs it; the OFFs keep the counts and drop timings and cache state.
EXPLAIN (ANALYZE, BUFFERS OFF, COSTS OFF, TIMING OFF, SUMMARY OFF)
SELECT booked_on, amount
FROM perf.postings
WHERE account_id = 42 AND booked_on >= '2026-04-01'
ORDER BY booked_on;
