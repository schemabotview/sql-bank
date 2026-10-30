-- queries/query/03-ranges.sql — transactions booked on 2 and 3 October.
-- A half-open range: from midnight on the 2nd, up to (not including) the 4th.
SELECT txn_id, kind, reference, booked_at
FROM core.transactions
WHERE booked_at >= '2026-10-02' AND booked_at < '2026-10-04'
ORDER BY booked_at;
