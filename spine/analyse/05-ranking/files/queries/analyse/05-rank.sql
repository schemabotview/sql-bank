-- queries/analyse/05-rank.sql — which accounts use their card most often?
SELECT p.account_id, count(*) AS card_payments,
       rank()       OVER (ORDER BY count(*) DESC) AS rank,
       dense_rank() OVER (ORDER BY count(*) DESC) AS dense_rank,
       row_number() OVER (ORDER BY count(*) DESC, p.account_id) AS row_number
FROM core.transactions t
JOIN core.postings p ON p.txn_id = t.txn_id AND p.amount < 0
WHERE t.kind = 'card'
GROUP BY p.account_id
ORDER BY row_number
LIMIT 5;
