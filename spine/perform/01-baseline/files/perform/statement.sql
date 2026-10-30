-- perform/statement.sql — the statement page: one account, April onwards.
SELECT booked_on, amount
FROM perf.postings
WHERE account_id = 42 AND booked_on >= '2026-04-01'
ORDER BY booked_on;
