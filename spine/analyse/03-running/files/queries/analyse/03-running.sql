-- queries/analyse/03-running.sql — Tom's statement with a running balance.
-- The window: every posting from the first up to this one, in time order.
SELECT t.booked_at::date AS day, t.reference, p.amount,
       sum(p.amount) OVER (ORDER BY t.booked_at, p.posting_id) AS balance
FROM core.postings p
JOIN core.transactions t USING (txn_id)
WHERE p.account_id = 1016
ORDER BY t.booked_at, p.posting_id;
