-- queries/analyse/07-islands.sql — runs of days Tom ended overdrawn.
WITH days AS (
  SELECT d::date AS day
  FROM generate_series(date '2026-10-01', date '2026-10-31', '1 day') AS d
), eod AS (                           -- his balance at the end of each day
  SELECT day, (SELECT sum(p.amount)
               FROM core.postings p JOIN core.transactions t USING (txn_id)
               WHERE p.account_id = 1016 AND t.booked_at < day + 1) AS balance
  FROM days
), overdrawn AS (                     -- consecutive days share day - n
  SELECT day, day - row_number() OVER (ORDER BY day)::int AS island
  FROM eod WHERE balance < 0
)
SELECT min(day) AS first_day, max(day) AS last_day, count(*) AS days
FROM overdrawn GROUP BY island ORDER BY first_day;
