-- perform/06-daily.sql — daily totals, computed once and STORED.
CREATE MATERIALIZED VIEW perf.daily_totals AS
SELECT booked_on, count(*) AS postings, sum(amount) AS net
FROM perf.postings
GROUP BY booked_on;
CREATE UNIQUE INDEX ON perf.daily_totals (booked_on);  -- allows CONCURRENTLY
