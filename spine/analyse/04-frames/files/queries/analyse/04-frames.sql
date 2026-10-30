-- queries/analyse/04-frames.sql — the whole ledger, summed in time order.
-- Both legs of a transaction share booked_at: they are PEERS in this order.
SELECT p.txn_id, p.account_id, p.amount,
       sum(p.amount) OVER (ORDER BY t.booked_at
                           ROWS  UNBOUNDED PRECEDING) AS rows_sum,
       sum(p.amount) OVER (ORDER BY t.booked_at
                           RANGE UNBOUNDED PRECEDING) AS range_sum
FROM core.postings p
JOIN core.transactions t USING (txn_id)
ORDER BY t.booked_at, p.posting_id
LIMIT 6;
