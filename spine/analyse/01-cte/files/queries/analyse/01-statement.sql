-- queries/analyse/01-statement.sql — Tom's October statement, in stages.
WITH tom AS (                       -- stage 1: Tom's postings, with dates
  SELECT p.amount, t.booked_at
  FROM core.postings p JOIN core.transactions t USING (txn_id)
  WHERE p.account_id = 1016
), opening AS (                     -- stage 2: what he had on 1 October
  SELECT coalesce(sum(amount), 0) AS opening
  FROM tom WHERE booked_at < '2026-10-01'
), october AS (                     -- stage 3: October's money in and out
  SELECT sum(amount) FILTER (WHERE amount > 0) AS paid_in,
         sum(amount) FILTER (WHERE amount < 0) AS paid_out
  FROM tom WHERE booked_at >= '2026-10-01' AND booked_at < '2026-11-01'
)
SELECT opening, paid_in, paid_out, opening + paid_in + paid_out AS closing
FROM opening, october;
